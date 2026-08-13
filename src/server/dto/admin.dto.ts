import { z } from "zod";

// ========================================
// KPI Item Schema (Single KPI Card)
// ========================================

export const kpiItemSchema = z.object({
  value: z.number(),
  changePercentage: z.number(),
});

export type KpiItem = z.infer<typeof kpiItemSchema>;

// ========================================
// Dashboard KPI Schema
// ========================================

export const dashboardKpiSchema = z.object({
  totalRevenue: kpiItemSchema,
  activeUsers: kpiItemSchema,
  activeDrivers: kpiItemSchema,
  pendingDeliveries: kpiItemSchema,
});

export type DashboardKpi = z.infer<typeof dashboardKpiSchema>;

// ========================================
// Revenue Chart Data Schema
// ========================================

export const revenueChartItemSchema = z.object({
  name: z.string(), // Month name (e.g., "Jan")
  total: z.number(), // GMV for that month
});

export type RevenueChartItem = z.infer<typeof revenueChartItemSchema>;

// ========================================
// Dashboard Stats Response Schema
// ========================================

export const dashboardStatsDataSchema = z.object({
  kpi: dashboardKpiSchema,
  charts: z.object({
    revenue: z.array(revenueChartItemSchema),
  }),
});

export type DashboardStatsData = z.infer<typeof dashboardStatsDataSchema>;

export const dashboardStatsResponseSchema = z.object({
  success: z.literal(true),
  data: dashboardStatsDataSchema,
});

export type DashboardStatsResponse = z.infer<typeof dashboardStatsResponseSchema>;

// ========================================
// Activity Item Schema
// ========================================

export const activityItemSchema = z.object({
  id: z.string(),
  user: z.string(),
  action: z.string(),
  target: z.string(),
  time: z.string(), // ISO Date string
  avatar: z.string(), // User initials
});

export type ActivityItem = z.infer<typeof activityItemSchema>;

// ========================================
// Activity Response Schema
// ========================================

export const activityDataSchema = z.array(activityItemSchema);

export type ActivityData = z.infer<typeof activityDataSchema>;

export const activityResponseSchema = z.object({
  success: z.literal(true),
  data: activityDataSchema,
});

export type ActivityResponse = z.infer<typeof activityResponseSchema>;

// ========================================
// Update User Status Input Schema
// ========================================

export const updateUserStatusInputSchema = z.object({
  banned: z.boolean(),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusInputSchema>;

// ========================================
// Update User Status Response Schema
// ========================================

export const updatedUserDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  banned: z.boolean(),
  updatedAt: z.string(),
});

export type UpdatedUserData = z.infer<typeof updatedUserDataSchema>;

export const updateUserStatusResponseSchema = z.object({
  success: z.literal(true),
  data: updatedUserDataSchema,
  message: z.string(),
});

export type UpdateUserStatusResponse = z.infer<typeof updateUserStatusResponseSchema>;

// ========================================
// Error Response Schema
// ========================================

export const adminErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type AdminErrorResponse = z.infer<typeof adminErrorResponseSchema>;
