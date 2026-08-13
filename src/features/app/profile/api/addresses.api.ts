export interface Address {
    id: string;
    label: string;
    street: string;
    city: string;
    zip: string;
    country: string;
    details?: string;
    isDefault: boolean;
    lat?: number;
    lng?: number;
}

export interface CreateAddressInput {
    label: string;
    street: string;
    city: string;
    zip: string;
    country: string;
    details?: string;
    lat: number;
    lng: number;
    isDefault?: boolean;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

export async function fetchAddresses(): Promise<Address[]> {
    const res = await fetch("/api/user/addresses");
    const data: ApiResponse<Address[]> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch addresses");
    }

    return data.data || [];
}

export async function fetchAddressById(id: string): Promise<Address> {
    const res = await fetch(`/api/user/addresses/${id}`);
    const data: ApiResponse<Address> = await res.json();

    if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to fetch address");
    }

    return data.data;
}

export async function createAddress(input: CreateAddressInput): Promise<Address> {
    const res = await fetch("/api/user/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });

    const data: ApiResponse<Address> = await res.json();

    if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to create address");
    }

    return data.data;
}

export async function updateAddress(id: string, input: Partial<CreateAddressInput>): Promise<Address> {
    const res = await fetch(`/api/user/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });

    const data: ApiResponse<Address> = await res.json();

    if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to update address");
    }

    return data.data;
}

export async function deleteAddress(id: string): Promise<void> {
    const res = await fetch(`/api/user/addresses/${id}`, {
        method: "DELETE",
    });

    const data: ApiResponse<void> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to delete address");
    }
}

export async function setDefaultAddress(id: string): Promise<void> {
    const res = await fetch(`/api/user/addresses/${id}/set-default`, {
        method: "POST",
    });

    const data: ApiResponse<void> = await res.json();

    if (!data.success) {
        throw new Error(data.error?.message || "Failed to set default address");
    }
}
