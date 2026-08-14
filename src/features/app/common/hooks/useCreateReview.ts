"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CreateReviewInput } from "@/server/dto/reviews.dto";

async function createReview(data: CreateReviewInput) {
    const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    const body = await res.json();

    if (!res.ok) {
        throw new Error(body.error?.message || "Failed to create review");
    }

    return body.data;
}

export function useCreateReview() {
    const queryClient = useQueryClient();
    const router = useRouter();

    return useMutation({
        mutationFn: createReview,
        onSuccess: () => {
            toast.success("Review posted successfully");
            queryClient.invalidateQueries({ queryKey: ["reviews"] });
            queryClient.invalidateQueries({ queryKey: ["my-reviews"] });
            // Invalidate listing reviews if needed
            queryClient.invalidateQueries({ queryKey: ["listing-reviews"] });
            queryClient.invalidateQueries({ queryKey: ["user-stats"] });
            // Flip the delivery detail's review button to its "reviewed" state
            queryClient.invalidateQueries({ queryKey: ["can-review"] });

            router.refresh();
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });
}
