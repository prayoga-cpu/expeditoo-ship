-- The last run of each scheduled job, stamped by its /api/cron/* route after
-- an authorised run, so Admin → Paramètres can show whether the jobs run at
-- all (client_feedback_2026_10_21_spec.md §X1). They had never run in
-- production — the GitHub workflow was missing APP_URL and CRON_SECRET — and
-- nothing inside the app could tell. Additive; nothing reads it but the admin.
CREATE TABLE IF NOT EXISTS "cron_heartbeat" (
	"job" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp NOT NULL,
	"last_ok" boolean NOT NULL,
	"last_error" text,
	"last_ok_at" timestamp
);
