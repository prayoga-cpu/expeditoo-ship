import { nanoid } from "nanoid";
import { addressesDal } from "@/server/dal/addresses.dal";
import {
  createAddressSchema,
  updateAddressSchema,
} from "@/server/dto/addresses.dto";

export const addressesService = {
  /**
   * Create a new address for user
   */
  async create(userId: string, input: unknown) {
    // Validate input
    const data = createAddressSchema.parse(input);

    // If this is set as default, clear other defaults first
    if (data.isDefault) {
      await addressesDal.clearDefaultForUser(userId);
    }

    // Create the address
    const address = await addressesDal.create({
      id: nanoid(),
      userId,
      label: data.label,
      street: data.street,
      city: data.city,
      zip: data.zip,
      country: data.country,
      details: data.details,
      lat: data.lat,
      lng: data.lng,
      isDefault: data.isDefault,
    });

    return address;
  },

  /**
   * Get all addresses for user
   */
  async getByUserId(userId: string) {
    return await addressesDal.getByUserId(userId);
  },

  /**
   * Get default address for user
   */
  async getDefaultAddress(userId: string) {
    return await addressesDal.getDefaultByUserId(userId);
  },

  /**
   * Get single address by ID
   */
  async getById(id: string, userId: string) {
    const address = await addressesDal.getById(id);

    if (!address) {
      throw new Error("Address not found");
    }

    if (address.userId !== userId) {
      throw new Error("Not authorized to access this address");
    }

    return address;
  },

  /**
   * Update an address
   */
  async update(id: string, userId: string, input: unknown) {
    // Verify ownership
    const owner = await addressesDal.getOwner(id);
    if (!owner) {
      throw new Error("Address not found");
    }
    if (owner !== userId) {
      throw new Error("Not authorized to modify this address");
    }

    // Validate input
    const data = updateAddressSchema.parse(input);

    // If setting as default, clear other defaults first
    if (data.isDefault) {
      await addressesDal.clearDefaultForUser(userId);
    }

    // Update the address
    const updated = await addressesDal.update(id, data);
    return updated;
  },

  /**
   * Delete an address
   */
  async delete(id: string, userId: string) {
    // Verify ownership
    const owner = await addressesDal.getOwner(id);
    if (!owner) {
      throw new Error("Address not found");
    }
    if (owner !== userId) {
      throw new Error("Not authorized to delete this address");
    }

    return await addressesDal.delete(id);
  },

  /**
   * Set an address as default
   */
  async setAsDefault(id: string, userId: string) {
    // Verify ownership
    const owner = await addressesDal.getOwner(id);
    if (!owner) {
      throw new Error("Address not found");
    }
    if (owner !== userId) {
      throw new Error("Not authorized to modify this address");
    }

    return await addressesDal.setAsDefault(id, userId);
  },
};
