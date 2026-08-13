"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Star } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCreateReview } from "../hooks/useCreateReview";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

// Schema for the review form
const reviewFormSchema = z.object({
    rating: z.number().min(1, "Please select at least 1 star").max(5),
    comment: z.string().max(1000, "Comment is too long").optional(),
});

type ReviewFormValues = z.infer<typeof reviewFormSchema>;

interface CreateReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetUserId: string;
    targetUserName?: string;
    listingId?: string;
    shipmentId: string;
}

export function CreateReviewModal({
    isOpen,
    onClose,
    targetUserId,
    targetUserName = "User",
    listingId,
    shipmentId,
}: CreateReviewModalProps) {
    const t = useTranslations("reviews.modal");
    const [hoveredRating, setHoveredRating] = useState(0);
    const { mutate: createReview, isPending } = useCreateReview();

    const form = useForm<ReviewFormValues>({
        resolver: zodResolver(reviewFormSchema),
        defaultValues: {
            rating: 0,
            comment: "",
        },
    });

    const rating = form.watch("rating");

    const onSubmit = (data: ReviewFormValues) => {
        createReview(
            {
                shipmentId,
                rating: data.rating,
                comment: data.comment,
            },
            {
                onSuccess: () => {
                    form.reset();
                    onClose();
                },
            }
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t("title", { name: targetUserName })}</DialogTitle>
                    <DialogDescription>
                        {t("description")}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                    <div className="space-y-2 flex flex-col items-center justify-center">
                        <Label>{t("ratingLabel")}</Label>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    className="p-1 focus:outline-hidden transition-transform hover:scale-110"
                                    onMouseEnter={() => setHoveredRating(star)}
                                    onMouseLeave={() => setHoveredRating(0)}
                                    onClick={() => form.setValue("rating", star)}
                                >
                                    <Star
                                        className={cn(
                                            "w-8 h-8 transition-colors duration-200",
                                            (hoveredRating || rating) >= star
                                                ? "fill-yellow-400 text-yellow-400 drop-shadow-sm"
                                                : "text-muted-foreground/30"
                                        )}
                                    />
                                </button>
                            ))}
                        </div>
                        {form.formState.errors.rating && (
                            <p className="text-sm text-destructive font-medium">
                                {form.formState.errors.rating.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="comment">{t("commentLabel")}</Label>
                        <Textarea
                            id="comment"
                            placeholder={t("commentPlaceholder")}
                            className="resize-none h-32"
                            {...form.register("comment")}
                        />
                        <p className="text-xs text-muted-foreground text-right">
                            {form.watch("comment")?.length || 0}/1000
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isPending}
                        >
                            {t("cancel")}
                        </Button>
                        <Button type="submit" disabled={isPending || rating === 0}>
                            {isPending ? t("submitting") : t("submit")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
