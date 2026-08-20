"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { stopImpersonating } from "@/features/app/admin/api/users.api";
import { useAuthActions } from "@/features/auth/hooks/useAuthActions";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface UserStats {
  average: number;
  total: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

interface AddressData {
  id: string;
  label: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  isDefault: boolean;
}

/**
 * Fetch user rating stats from API
 */
async function fetchUserStats(userId: string): Promise<UserStats> {
  const res = await fetch(`/api/users/${userId}/stats`);
  const data = await res.json();
  if (data.success) {
    return data.data;
  }
  return {
    average: 0,
    total: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
}

/**
 * Fetch user's default address from API
 */
async function fetchDefaultAddress(): Promise<AddressData | null> {
  const res = await fetch("/api/user/addresses/default");
  const data = await res.json();
  if (data.success && data.data) {
    return data.data;
  }
  return null;
}

/**
 * Fetch user's Stripe status directly from database
 * Bypasses session cache for real-time status
 */
async function fetchStripeStatus(): Promise<{
  stripeAccountId: string | null;
  stripeAccountStatus: string | null;
}> {
  const res = await fetch("/api/users/me/stripe-status");
  const data = await res.json();
  if (data.success && data.data) {
    return data.data;
  }
  return { stripeAccountId: null, stripeAccountStatus: null };
}

/**
 * Custom hook for profile data and actions
 * Follows Single Responsibility - handles profile data and logout
 */
export function useProfile() {
  const { user: userData, session, isLoading } = useAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();

  const { toast } = useToast();

  // Profile picture upload state
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Fetch user rating stats from API
  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["user-stats", userData?.id],
    queryFn: () => fetchUserStats(userData!.id),
    enabled: !!userData?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch user's default address from API
  const { data: defaultAddress, isLoading: isAddressLoading } = useQuery({
    queryKey: ["user-default-address"],
    queryFn: fetchDefaultAddress,
    enabled: !!userData?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch Stripe status directly from database (bypasses stale session)
  const { data: stripeStatus, isLoading: isStripeLoading } = useQuery({
    queryKey: ["user-stripe-status"],
    queryFn: fetchStripeStatus,
    enabled: !!userData?.id,
    staleTime: 30 * 1000, // Shorter cache (30s) for more responsive updates
  });

  // User data from auth context with real rating stats and address
  const user = useMemo(
    () => ({
      name: userData?.name || "User",
      email: userData?.email || "",
      rating: stats?.average || 0,
      reviews: stats?.total || 0,
      type: "Particulier",
      image: userData?.image,
      isVerified: userData?.isVerified ?? false,
      address: {
        street: defaultAddress?.street || "",
        city: defaultAddress?.city || "",
        zip: defaultAddress?.zip || "",
        country: defaultAddress?.country || "",
      },
      // Use stripeStatus from API (fresh from DB) instead of session
      stripeAccountId: stripeStatus?.stripeAccountId,
      stripeAccountStatus: stripeStatus?.stripeAccountStatus,
    }),
    [userData, stats, defaultAddress, stripeStatus]
  );

  // Check if user is using OAuth (Google SSO)
  const [isOAuthUser, setIsOAuthUser] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<string | null>(null);

  useEffect(() => {
    const checkProvider = async () => {
      try {
        const res = await fetch("/api/users/me/provider");
        const data = await res.json();
        if (data.success) {
          setIsOAuthUser(data.data.isOAuth);
          setOauthProvider(data.data.provider);
        }
      } catch (error) {
        console.error("Failed to check auth provider:", error);
      }
    };

    if (userData) {
      checkProvider();
    }
  }, [userData]);

  // Mock payment methods data (will be replaced with Stripe integration)
  const [cards, setCards] = useState([
    { id: 1, last4: "4242", brand: "VISA", expiry: "12/24" },
    { id: 2, last4: "8888", brand: "MC", expiry: "09/25" },
  ]);

  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [newCard, setNewCard] = useState({ number: "", expiry: "", cvc: "" });

  /**
   * Upload profile picture
   */
  /**
   * Upload profile picture
   */
  const uploadProfilePicture = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      setIsUploadingImage(true);

      try {
        // Step 1: Upload image to storage
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload image");
        }

        const uploadData = await uploadRes.json();
        if (!uploadData.success) {
          throw new Error(uploadData.error?.message || "Upload failed");
        }

        const imageUrl = uploadData.data.url;

        // Step 2: Update user profile and session via Better Auth Client
        // This ensures the session is updated immediately
        await authClient.updateUser({
          image: imageUrl,
        });

        // Step 3: Refresh page to reflect changes everywhere
        window.location.reload();
      } catch (error) {
        console.error("Profile picture upload error:", error);
        toast({
          title: "Upload failed",
          description:
            error instanceof Error ? error.message : "Failed to upload image",
          variant: "destructive",
        });
      } finally {
        setIsUploadingImage(false);
      }
    },
    [toast]
  );

  const handleAddCard = useCallback(() => {
    // Mock add card logic - will be replaced with Stripe integration
    const card = {
      id: Date.now(),
      last4: newCard.number.slice(-4) || "0000",
      brand: "VISA",
      expiry: newCard.expiry || "12/25",
    };
    setCards((prev) => [...prev, card]);
    setIsAddCardOpen(false);
    setNewCard({ number: "", expiry: "", cvc: "" });
  }, [newCard]);

  const handleDeleteCard = useCallback((id: number) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleLogout = useCallback(async () => {
    // While an admin is viewing this account, "log out" means leave the
    // account -- not destroy the borrowed session. Signing out here would
    // clear the session cookie and orphan the parked `admin_session` one,
    // dropping the admin at the sign-in screen with their own session still
    // alive but unreachable.
    if ((session as { impersonatedBy?: string | null } | null)?.impersonatedBy) {
      await stopImpersonating().catch(() => {});
      window.location.assign("/admin/users");
      return;
    }

    await signOut();
    router.push("/");
  }, [signOut, router, session]);

  /**
   * Remove profile picture
   */
  /**
   * Remove profile picture
   */
  const removeProfilePicture = useCallback(async () => {
    setIsUploadingImage(true);

    try {
      // Update user profile and session via Better Auth Client
      await authClient.updateUser({
        image: null, // Better Auth might require special handling for null, but usually works
      } as any); // Cast as any if type definition is strict about string

      // Refresh page
      window.location.reload();
    } catch (error) {
      console.error("Remove profile picture error:", error);
      toast({
        title: "Failed to remove",
        description:
          error instanceof Error ? error.message : "Failed to remove picture",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
    }
  }, [toast]);

  return {
    user,
    isLoading:
      isLoading || isStatsLoading || isAddressLoading || isStripeLoading,
    cards,
    isAddCardOpen,
    setIsAddCardOpen,
    newCard,
    setNewCard,
    handleAddCard,
    handleDeleteCard,
    handleLogout,
    // Profile picture upload
    isUploadingImage,
    uploadProfilePicture,
    removeProfilePicture,
    // OAuth
    isOAuthUser,
    oauthProvider,
  };
}
