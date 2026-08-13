import { z } from "zod";

export const createDriverApplicationSchema = z.object({
  vehicleType: z.string().min(1, "Type de véhicule requis"),
  vehiclePlate: z
    .string()
    .min(3, "Immatriculation invalide")
    .max(15, "Immatriculation invalide")
    .regex(/^[A-Z0-9-]+$/, "Format d'immatriculation invalide"),
  licenseNumber: z.string().min(5, "Numéro de permis requis"),
  siret: z
    .string()
    .length(14, "Le numéro SIRET doit contenir exactement 14 chiffres")
    .regex(/^\d+$/, "Le numéro SIRET ne doit contenir que des chiffres"),
  companyName: z.string().optional(),
  proposalRate: z.string().optional(),
});

export type CreateDriverApplicationInput = z.infer<
  typeof createDriverApplicationSchema
>;

export const updateDriverApplicationStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export type UpdateDriverApplicationStatusInput = z.infer<
  typeof updateDriverApplicationStatusSchema
>;
