-- Escalated jobs stop saying where they came from. Client feedback
-- 2026-09-29: "No need to inform about expedion-Encheres"
-- (docs/specs/expedion_source_hidden_spec.md). `buildDescription` in
-- expedion-escalation.service.ts appended « Job escaladé depuis Expedion
-- Enchères. » to every escalated job, and drivers read the description on the
-- job page. The generator no longer writes it; this takes it out of the jobs
-- already stored.
--
-- An exact match on the machine-written sentence, and only on escalated jobs,
-- so nothing a person typed can be touched. The generator always put it last,
-- after a space. Re-runnable: a second pass finds nothing to replace. The
-- 20-character floor on `description` still holds, because the pickup line
-- written before the sentence is longer than that on its own.

UPDATE "listings"
SET "description" = rtrim(replace("description", ' Job escaladé depuis Expedion Enchères.', ''))
WHERE "origin" = 'expedion'
  AND "description" LIKE '%Job escaladé depuis Expedion Enchères.%';
