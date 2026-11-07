import { describe, expect, it } from "vitest";
import {
  IDENTITY_FIELD,
  mimeFor,
  objectKeyFor,
  planDocuments,
} from "../airtable-documents";

const file = (id: string, extra: object = {}) => ({
  id,
  url: `https://dl.airtable.com/${id}`,
  filename: `${id}.pdf`,
  ...extra,
});

describe("planDocuments", () => {
  it("names each attachment's kind and a key that never changes between runs", () => {
    const plan = planDocuments("recA", {
      "Bordereaux (document)": [file("att1")],
      "FACTURE EDITION": [file("att2")],
      "PROCURATION DOC": [file("att3")],
    });
    expect(plan.map((p) => [p.kind, p.objectKey])).toEqual([
      ["bordereau", objectKeyFor("recA", "att1")],
      ["invoice", objectKeyFor("recA", "att2")],
      ["procuration", objectKeyFor("recA", "att3")],
    ]);
    expect(plan[0].primary).toBe(true);
    expect(plan[1].primary).toBe(false);
  });

  it("stores a file that sits in two columns once", () => {
    const plan = planDocuments("recA", {
      "Bordereaux (document)": [file("att1")],
      "BORDEREAU 2 doc": [file("att1"), file("att2")],
    });
    expect(plan.map((p) => p.attachment.id)).toEqual(["att1", "att2"]);
  });

  it("leaves identity documents in Airtable unless asked", () => {
    const fields = { [IDENTITY_FIELD]: [file("id1")] };
    expect(planDocuments("recA", fields)).toEqual([]);
    expect(planDocuments("recA", fields, { includeIdentity: true })).toHaveLength(1);
  });

  it("ignores columns that are not attachment lists", () => {
    expect(
      planDocuments("recA", { "Bordereaux (document)": "not a list", Images: [{}] })
    ).toEqual([]);
  });
});

describe("mimeFor", () => {
  it("trusts Airtable's type, then the extension", () => {
    expect(mimeFor(file("a", { type: "application/pdf" }))).toBe("application/pdf");
    expect(mimeFor({ id: "a", url: "u", filename: "Photo.JPG" })).toBe("image/jpeg");
    expect(mimeFor({ id: "a", url: "u" })).toBe("application/octet-stream");
  });
});
