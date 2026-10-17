"use client";

import { useEffect, useState } from "react";

// The mentions légales identity rows, filled from what an admin saved at
// /admin/settings (launch_readiness_spec.md §A.4).

export interface IdentityRow {
  label: string;
  value: string;
  pending?: boolean;
  /** The company field that fills this row once it is saved. */
  field?: string;
}

export type PublicCompany = Record<string, string | null>;

/** The saved identity, or none — the placeholders then stay as they are. */
export function usePublicCompany() {
  const [company, setCompany] = useState<PublicCompany | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/public/company")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (live && body?.success) setCompany(body.data as PublicCompany);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return company;
}

/** A pending row takes its saved value; anything unsaved stays pending. */
export function resolveIdentityRows(
  rows: IdentityRow[],
  company: PublicCompany | null
): IdentityRow[] {
  return rows.map((row) => {
    const saved = row.field ? company?.[row.field] : null;
    return saved ? { ...row, value: saved, pending: false } : row;
  });
}
