import { z } from "zod";

/** Two to twenty-five points, in the order the driver will drive them (§N8). */
export const MAX_PLAN_POINTS = 25;

export const routePlanSchema = z.object({
  points: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
    )
    .min(2, "PLAN_NEEDS_TWO_POINTS")
    .max(MAX_PLAN_POINTS, "PLAN_TOO_MANY_POINTS"),
});

export type RoutePlanInput = z.infer<typeof routePlanSchema>;
