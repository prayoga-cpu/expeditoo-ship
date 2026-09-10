import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImageCleanupService } from "../image-cleanup.service";

/**
 * These cover one thing: that the sweep refuses to empty the bucket.
 *
 * R2 deletion is not recoverable, and this runs unattended every Sunday at
 * 03:00 with deletion armed. The guard it replaced asked whether the database
 * referenced *exactly* zero images and then aborted only when the `user` table
 * had rows — so an empty database fell through to "delete everything", and a
 * database referencing a single image skipped the check outright and deleted
 * every other object. Production was re-pointed at an empty database on
 * 2026-09-10, which is precisely that state.
 */

const listObjects = vi.fn();
const deleteImage = vi.fn();

vi.mock("@/server/services/storage.service", () => ({
  storageService: {
    listObjects: (...a: unknown[]) => listObjects(...a),
    deleteImage: (...a: unknown[]) => deleteImage(...a),
  },
}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({
  user: {},
  categories: {},
  photos: {},
  shipmentEvents: {},
  shipmentIncidents: {},
}));
vi.mock("@/db/schema/messages", () => ({ messages: {} }));
vi.mock("@/db/schema/expedion", () => ({ expedionQuotes: {} }));
vi.mock("@/server/dal/expedion-files.dal", () => ({ expedionFilesDal: {} }));


/** Drives performCleanup with a chosen set of referenced keys and bucket keys. */
function serviceWith(validKeys: string[], bucketKeys: string[]) {
  const svc = new ImageCleanupService();
  vi.spyOn(svc, "getValidImageKeys").mockResolvedValue(new Set(validKeys));
  listObjects.mockResolvedValue({ keys: bucketKeys, nextCursor: undefined });
  return svc;
}

describe("ImageCleanupService.performCleanup safety floor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.IMAGE_CLEANUP_FORCE;
  });

  it("deletes nothing when the database references no images at all", async () => {
    // The fresh-database case. The old guard deleted the whole bucket here.
    const svc = serviceWith([], ["a.jpg", "b.jpg", "c.jpg"]);

    const res = await svc.performCleanup(false);

    expect(deleteImage).not.toHaveBeenCalled();
    expect(res.message).toMatch(/Aborted/i);
  });

  it("deletes nothing when one stray reference would justify wiping the rest", async () => {
    // The subtler case: a single signup avatar made validKeys non-zero, which
    // skipped the old check entirely and deleted all nine other objects.
    const bucket = Array.from({ length: 10 }, (_, i) => `img-${i}.jpg`);
    const svc = serviceWith(["img-0.jpg"], bucket);

    const res = await svc.performCleanup(false);

    expect(deleteImage).not.toHaveBeenCalled();
    expect(res.message).toMatch(/Aborted/i);
  });

  it("still deletes a small, believable backlog", async () => {
    const bucket = Array.from({ length: 20 }, (_, i) => `img-${i}.jpg`);
    const referenced = bucket.slice(0, 18); // 2 of 20 orphaned = 10%
    const svc = serviceWith(referenced, bucket);

    await svc.performCleanup(false);

    expect(deleteImage).toHaveBeenCalledTimes(2);
  });

  it("lets a human override the floor deliberately", async () => {
    process.env.IMAGE_CLEANUP_FORCE = "true";
    const svc = serviceWith([], ["a.jpg", "b.jpg"]);

    await svc.performCleanup(false);

    expect(deleteImage).toHaveBeenCalledTimes(2);
  });

  it("never deletes on a dry run, however bad the ratio", async () => {
    const svc = serviceWith([], ["a.jpg", "b.jpg"]);

    const res = await svc.performCleanup(true);

    // A dry run deletes nothing anyway, so the floor must not turn it into an
    // abort — the operator needs the full orphan list to decide.
    expect(deleteImage).not.toHaveBeenCalled();
    expect(res).toMatchObject({ success: true, dryRun: true });
    expect(res.stats.orphansFound).toBe(2);
  });

  it("does not abort on an empty bucket, which is not evidence of anything", async () => {
    const svc = serviceWith([], []);

    await svc.performCleanup(false);

    expect(deleteImage).not.toHaveBeenCalled();
  });
});
