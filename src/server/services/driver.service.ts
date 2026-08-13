import { driverApplicationDal } from "@/server/dal/driver.dal";
import {
  CreateDriverApplicationInput,
  UpdateDriverApplicationStatusInput,
} from "@/server/dto/driver.dto";
import { db } from "@/db";
import { userRoles } from "@/db/schema";

import { nanoid } from "nanoid";

export const driverService = {
  submitApplication: async (
    userId: string,
    data: CreateDriverApplicationInput
  ) => {
    // Check if user already has an application
    const existing = await driverApplicationDal.getByUserId(userId);
    if (existing) {
      throw new Error("Une candidature existe déjà pour cet utilisateur.");
    }

    return await driverApplicationDal.create({
      id: nanoid(),
      userId,
      ...data,
      status: "PENDING",
    });
  },

  getUserApplicationStatus: async (userId: string) => {
    return await driverApplicationDal.getByUserId(userId);
  },

  /**
   * Check if user is already a driver (has transporter role)
   */
  isUserDriver: async (userId: string): Promise<boolean> => {
    const existingRole = await db.query.userRoles.findFirst({
      where: (roles, { and, eq }) =>
        and(eq(roles.userId, userId), eq(roles.role, "transporter")),
    });
    return !!existingRole;
  },

  getAllApplications: async () => {
    return await driverApplicationDal.getAll();
  },

  updateApplicationStatus: async (
    applicationId: string,
    data: UpdateDriverApplicationStatusInput
  ) => {
    const application = await driverApplicationDal.getById(applicationId);
    if (!application) {
      throw new Error("Candidature introuvable.");
    }

    const updatedApplication = await driverApplicationDal.updateStatus(
      applicationId,
      data.status
    );

    // If approved, add DRIVER role to user
    if (data.status === "APPROVED") {
      // Check if user already has the role
      const existingRole = await db.query.userRoles.findFirst({
        where: (roles, { and, eq }) =>
          and(
            eq(roles.userId, application.userId),
            eq(roles.role, "transporter")
          ),
      });

      if (!existingRole) {
        await db.insert(userRoles).values({
          id: nanoid(),
          userId: application.userId,
          role: "transporter", // Using 'transporter' as the internal role name for drivers
        });
      }
    }

    return updatedApplication;
  },
};
