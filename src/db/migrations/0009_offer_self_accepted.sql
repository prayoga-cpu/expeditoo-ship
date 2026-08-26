-- Distinguishes a job a carrier took themselves from one somebody awarded them.
--
-- Hand-written for the same reason 0002-0008 were: 0002 left no snapshot, so
-- `drizzle-kit generate` would diff against 0001 and re-emit the whole
-- transport realignment on a database that already has it.
--
-- Self-accept lets an approved carrier take an open job without waiting to be
-- picked. The row it produces is otherwise identical to one an operator awarded
-- from the queue, which means that without this column every measure built on
-- the award queue — time-to-award, how often an operator intervenes, what the
-- reverse auction actually saved against the budget — quietly counts a driver
-- taking a job as a decision somebody made. `expedion_quotes.assigned_directly`
-- was added for exactly this reason on the pool-assignment lane.
--
-- Backfill is `false` for every existing row, which is correct: no offer
-- predating this could have been taken through a path that did not exist.

ALTER TABLE "offers"
  ADD COLUMN IF NOT EXISTS "self_accepted" boolean DEFAULT false NOT NULL;
