-- Wires `notify_on_match`, persisted since 0010 but read by nothing until now
-- (carrier_trips_spec.md §9, carriers_on_route_spec.md §8). Mirrors the
-- discoverable index added in 0020: narrows the two flag tests the alert
-- fan-out runs on every listing publish, ahead of the same bounding-box
-- arithmetic no index can serve (carrier_route_alerts_spec.md §5).

CREATE INDEX IF NOT EXISTS "carrier_route_notify_idx"
  ON "carrier_routes" ("notify_on_match", "is_active");
