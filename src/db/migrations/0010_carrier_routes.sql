-- Carrier trips: the routes a carrier already drives, recurring or on specific
-- dates (docs/specs/carrier_trips_spec.md).
--
-- Hand-written for the same reason 0002-0008 were: 0002 left no snapshot, so
-- `drizzle-kit generate` diffs against 0001 and re-emits the whole transport
-- realignment, plus every hand-written migration since, on a database that
-- already has all of it.
--
-- A trip is private to the carrier. It is a saved query against the job board,
-- not an offer and not a commitment, which is why nothing here references
-- listings, offers or users directly — only the carrier and, optionally, one of
-- their own vehicles.

CREATE TYPE "public"."carrier_route_kind" AS ENUM('recurring', 'occasional');--> statement-breakpoint

CREATE TABLE "carrier_routes" (
	"id" text PRIMARY KEY NOT NULL,
	"carrier_id" text NOT NULL,
	"label" text,
	"kind" "carrier_route_kind" NOT NULL,
	"origin_address" text NOT NULL,
	"origin_city" text NOT NULL,
	"origin_postal_code" text NOT NULL,
	"origin_lat" double precision NOT NULL,
	"origin_lng" double precision NOT NULL,
	"destination_address" text NOT NULL,
	"destination_city" text NOT NULL,
	"destination_postal_code" text NOT NULL,
	"destination_lat" double precision NOT NULL,
	"destination_lng" double precision NOT NULL,
	"radius_km" integer DEFAULT 50 NOT NULL,
	"days_of_week" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"vehicle_id" text,
	"capacity_kg" double precision,
	"notify_on_match" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- The "on specific dates" half of the ask. A child table rather than a JSON
-- column because dates are matched by range, and the unique constraint is what
-- stops a double-submitted form storing the same day twice.
CREATE TABLE "carrier_route_dates" (
	"id" text PRIMARY KEY NOT NULL,
	"route_id" text NOT NULL,
	"date" timestamp NOT NULL,
	CONSTRAINT "carrier_route_date_unique" UNIQUE("route_id","date")
);--> statement-breakpoint

ALTER TABLE "carrier_routes" ADD CONSTRAINT "carrier_routes_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- A retired vehicle must not take the trip with it: the trip still describes a
-- corridor the carrier drives, so the link goes null and the route survives.
ALTER TABLE "carrier_routes" ADD CONSTRAINT "carrier_routes_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "carrier_route_dates" ADD CONSTRAINT "carrier_route_dates_route_id_carrier_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."carrier_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "carrier_route_carrier_idx" ON "carrier_routes" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "carrier_route_active_idx" ON "carrier_routes" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "carrier_route_date_route_idx" ON "carrier_route_dates" USING btree ("route_id");
