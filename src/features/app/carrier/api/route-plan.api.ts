import { api } from "@/lib/fetcher";
import type { PlanPoint } from "../lib/plan-stops";

/** Mirrors `RoutePlan` (route-planner.service.ts). */
export interface PlannedRoute {
  distanceKm: number;
  durationMinutes: number;
  line: [number, number][];
}

export interface RoutePlan {
  withMotorway: PlannedRoute;
  withoutMotorway: PlannedRoute;
}

export const routePlanApi = {
  plan: (points: PlanPoint[]) =>
    api.post<RoutePlan>("/api/carrier/route-plan", { points }),
};
