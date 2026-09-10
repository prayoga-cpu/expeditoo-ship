import { db } from "@/db";
import {
  user,
  categories,
  photos,
  shipmentEvents,
  shipmentIncidents,
} from "@/db/schema";
import { messages } from "@/db/schema/messages";
import { expedionQuotes } from "@/db/schema/expedion";
import { feedbackTickets } from "@/db/schema/feedback";
import { storageService } from "@/server/services/storage.service";
import { expedionFilesDal } from "@/server/dal/expedion-files.dal";
import { isNotNull } from "drizzle-orm";

export class ImageCleanupService {
  /**
   * Collects all valid image keys from the database.
   * Returns a Set of keys (filenames) that are currently in use.
   */
  async getValidImageKeys(): Promise<Set<string>> {
    const validKeys = new Set<string>();

    // Helper to add URL to set after cleaning
    const addUrl = (url: string | null | undefined) => {
      if (!url) return;
      try {
        // We need to extract the key from the public URL.
        // The public URL is typically: https://<R2_PUBLIC_URL>/<key>
        // Or if R2_PUBLIC_URL path is empty: https://<domain>/<key>
        // Use R2_PUBLIC_URL from env if available to strip it.
        const publicUrl = process.env.R2_PUBLIC_URL;

        let key = url;
        if (publicUrl && url.startsWith(publicUrl)) {
           // Strip public URL + slash
           key = url.replace(`${publicUrl}/`, "");
        } else if (url.startsWith("http")) {
           // Fallback: if it doesn't match R2_PUBLIC_URL (maybe legacy or cdn alias),
           // try to strip protocol and domain generically.
           try {
             const urlObj = new URL(url);
             // path is /folder/file.jpg. Remove leading slash.
             key = urlObj.pathname.substring(1);
           } catch {
             // If URL parsing fails, keep original or verify logic
           }
        }
        
        // Final sanity check: if the key is empty or just a slash, ignore
        if (key && key !== "/") {
            validKeys.add(key);
        }
      } catch (e) {
        console.warn("Failed to parse image key from URL:", url);
      }
    };

    console.log("Fetching valid image keys from DB...");

    // 1. Users (profile images)
    const users = await db.select({ image: user.image }).from(user).where(isNotNull(user.image));
    users.forEach((u) => addUrl(u.image));
    console.log(`Scanned ${users.length} users`);

    // 2. Categories (category images)
    const cats = await db.select({ image: categories.image }).from(categories).where(isNotNull(categories.image));
    cats.forEach((c) => addUrl(c.image));
    console.log(`Scanned ${cats.length} categories`);

    // 3. Listing Images
    const lImages = await db.select({ url: photos.url }).from(photos);
    lImages.forEach((i) => addUrl(i.url));
    console.log(`Scanned ${lImages.length} listing images`);

    // 4. Shipment photos are NOT scanned, and must not be: they live in a
    // private bucket of their own (shipment_photos_spec.md §4), so nothing
    // here can reach them and nothing here should try. This sweep only ever
    // sees the public bucket.

    // 4b. Incident photos. Unlike shipment photos above, these ARE in the
    // public bucket - `uploadIncidentPhoto` posts to /api/upload, which writes
    // to R2_BUCKET_NAME - so they have to be declared here or every one of them
    // is an orphan by construction and this sweep deletes it on the next
    // Sunday run. They are the evidence a damage or loss dispute is argued
    // from, so losing them is the expensive kind of silent.
    const incidents = await db
      .select({ photoUrls: shipmentIncidents.photoUrls })
      .from(shipmentIncidents);
    incidents.forEach((incident) =>
      (incident.photoUrls ?? []).forEach((url) => addUrl(url))
    );
    console.log(`Scanned ${incidents.length} shipment incidents`);

    // 5. Messages (Attachments)
    const msgs = await db
      .select({ attachmentUrl: messages.attachmentUrl })
      .from(messages)
      .where(isNotNull(messages.attachmentUrl));
    msgs.forEach((m) => addUrl(m.attachmentUrl));
    console.log(`Scanned ${msgs.length} messages`);

    // 6. Shipment Events (Metadata - potentially contains images)
    // We only fetch events that might have metadata
    const events = await db
      .select({ metadata: shipmentEvents.metadata })
      .from(shipmentEvents)
      .where(isNotNull(shipmentEvents.metadata));

    let eventImageCount = 0;
    events.forEach((e) => {
      if (e.metadata) {
        try {
          // Metadata is a JSON string. It might contain "photoUrl" or similar fields.
          // Since structure varies, we'll do a naive scan for values that look like our image URLs.
          // Or parse it if we know the structure.
          // For now, let's try to parse as object and look for common keys or traverse.
          const data = JSON.parse(e.metadata);
          
          // Helper to recursively find strings looking like urls
          const findUrls = (obj: any) => {
             if (typeof obj === 'string') {
                 // Check if it looks like an image URL (heuristic: extensions or contains our R2 domain if known)
                 // Or just simpler: if it has a slash and looks like a filename.
                 // To be safe, let's just add anything that looks like a filename if it matches one of our keys?
                 // No, we need to KNOW valid keys.
                 // Valid approach: If it looks like a URL, add it.
                 if (obj.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
                     addUrl(obj);
                     eventImageCount++;
                 }
             } else if (typeof obj === 'object' && obj !== null) {
                 Object.values(obj).forEach(findUrls);
             }
          }
          findUrls(data);

        } catch (err) {
          // ignore parsing errors
        }
      }
    });
    console.log(`Scanned ${eventImageCount} images impacts from ${events.length} events`);

    // 7. Expedion documents.
    //
    // Belt and braces. These objects are meant to live in a private bucket of
    // their own (`expedion-storage.service.ts` refuses to start against
    // `R2_BUCKET_NAME` precisely so this sweep can never see them), but that is
    // one environment variable away from being wrong, and the failure mode if
    // it is wrong is this cron deleting every bordereau on the platform on its
    // first non-dry run. So the keys are declared here anyway.
    //
    // `expedion_files.object_key` is the real reference — the quote columns
    // hold `/api/expedion/files/<id>`, whose pathname is a route, not a key.
    // The two quote columns are still scanned for the pre-migration rows,
    // whose values are Firebase URLs this bucket never held: harmless entries
    // in a set that only ever spares objects.
    const expedionKeys = await expedionFilesDal.listObjectKeys();
    expedionKeys.forEach((key) => validKeys.add(key));
    console.log(`Scanned ${expedionKeys.length} Expedion documents`);

    const quoteDocs = await db
      .select({
        bordereauDocUrl: expedionQuotes.bordereauDocUrl,
        photoUrls: expedionQuotes.photoUrls,
      })
      .from(expedionQuotes);
    quoteDocs.forEach((q) => {
      addUrl(q.bordereauDocUrl);
      (q.photoUrls ?? []).forEach((u) => addUrl(u));
    });
    console.log(`Scanned ${quoteDocs.length} Expedion quotes`);

    // 8. Feedback screenshots.
    //
    // Declaring these is MANDATORY, not tidiness. This sweep deletes every
    // object in the public bucket it cannot match to a column, so a screenshot
    // that is not scanned here is an orphan by construction and vanishes on the
    // next non-dry Sunday run — the same warning incident photos carry above.
    // See docs/specs/feedback_spec.md §7 item 7.
    const feedbackRows = await db
      .select({ screenshotUrls: feedbackTickets.screenshotUrls })
      .from(feedbackTickets);
    feedbackRows.forEach((row) =>
      (row.screenshotUrls ?? []).forEach((u) => addUrl(u))
    );
    console.log(`Scanned ${feedbackRows.length} feedback tickets`);

    return validKeys;
  }

  async performCleanup(dryRun = true) {
    const validKeys = await this.getValidImageKeys();
    console.log(`Found ${validKeys.size} valid unique referenced images.`);

    let cursor: string | undefined;
    const orphans: string[] = [];
    let processedCount = 0;

    do {
      const result = await storageService.listObjects(cursor);
      cursor = result.nextCursor;
      const keys = result.keys;

      for (const key of keys) {
        processedCount++;
        // Check if key exists in valid set
        if (!validKeys.has(key)) {
          orphans.push(key);
        }
      }
    } while (cursor);

    console.log(`Scanned ${processedCount} objects from storage.`);
    console.log(`Found ${orphans.length} orphan images.`);

    /*
     * The safety floor, and it has to be decided here rather than up front,
     * because "how much of the bucket would this delete" is only knowable
     * after the listing.
     *
     * The check this replaces asked whether `validKeys` was exactly zero and
     * then aborted only when the `user` table had rows — which got the
     * dangerous case backwards twice over. An **empty** database fell straight
     * through to deletion, and a database referencing a **single** image
     * skipped the check outright and deleted every other object in the bucket.
     * Both are the same error: reading "the database references little" as
     * proof the bucket holds rubbish, when it is equally proof that this is
     * not the database that filled the bucket. Production was re-pointed at an
     * empty Neon database on 2026-09-10, which is exactly that situation, and
     * this sweep runs armed every Sunday at 03:00.
     *
     * R2 deletion is not recoverable, so the rule is proportional and fails
     * closed: refuse when the database references nothing at all, and refuse
     * when the sweep wants to remove more than a fifth of what it just listed.
     * A genuine backlog above that share is a decision for a human, taken with
     * `IMAGE_CLEANUP_FORCE=true` after reading a dry run — not something a cron
     * should conclude on its own at three in the morning.
     */
    const ORPHAN_SHARE_CEILING = 0.2;
    const orphanShare = processedCount === 0 ? 0 : orphans.length / processedCount;
    const forced = process.env.IMAGE_CLEANUP_FORCE === "true";
    const refusal =
      validKeys.size === 0
        ? "the database references no images at all"
        : orphanShare > ORPHAN_SHARE_CEILING
          ? `it would delete ${orphans.length} of ${processedCount} objects (${Math.round(orphanShare * 100)}%, ceiling ${ORPHAN_SHARE_CEILING * 100}%)`
          : null;

    if (!dryRun && refusal && !forced) {
      console.warn(`ABORTING image cleanup: ${refusal}.`);
      return {
        message: `Aborted: ${refusal}. Re-run as a dry run to inspect, then set IMAGE_CLEANUP_FORCE=true if this is genuinely intended.`,
        stats: {
          validKeys: validKeys.size,
          scanned: processedCount,
          orphansFound: orphans.length,
          deleted: 0,
        },
      };
    }

    if (!dryRun) {
      console.log("Deleting orphans...");
      for (const orphan of orphans) {
        try {
           // We need the full URL to delete? 
           // storageService.deleteImage just passes it to provider.delete.
           // R2Provider.delete expects a URL OR a filename (it strips public url).
           // So passing the key (filename) should work if provider handles it like "fileUrl.replace(...)".
           // If we pass just "filename.jpg", replace will do nothing if it doesn't match publicUrl/filename.
           // However, R2Provider.delete implementations usually act on KEYS. 
           // Let's verify R2Provider.delete implementation again.
           // It does: const fileName = fileUrl.replace(`${this.publicUrl}/`, "");
           // So if we pass "filename.jpg", it remains "filename.jpg", which is correct for Key.
           await storageService.deleteImage(orphan);
        } catch (e) {
            console.error(`Failed to delete ${orphan}`, e);
        }
      }
      console.log("Deletion complete.");
    } else {
        console.log("Dry run: Skipping deletion.");
    }

    return {
      success: true,
      stats: {
        validKeys: validKeys.size,
        scanned: processedCount,
        orphansFound: orphans.length,
        orphans: orphans.slice(0, 50) // Return first 50 for inspection
      },
      dryRun
    };
  }
}

export const imageCleanupService = new ImageCleanupService();
