"use client";

import type React from "react";

import { useState, useRef } from "react";
import { Upload, X, Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { Button } from "@/components/ui/button";
import { uploadImage } from "../api";

/**
 * Matches the `photos` cap the server enforces on a listing — `.max(10)` in
 * `listings.dto.ts`. It used to be 5 while claiming to match, so half the
 * allowance was unreachable.
 */
const MAX_PHOTOS = 10;

interface PhotoDropzoneProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
}

export function PhotoDropzone({ photos, onPhotosChange }: PhotoDropzoneProps) {
  const t = useTranslations("create.dropzone");
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // A second input, because "Prendre une photo" shared the gallery picker's and
  // so opened the gallery on a phone: a button that could not take a photo.
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const remaining = MAX_PHOTOS - photos.length;
  const isFull = remaining <= 0;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(!isFull && (e.type === "dragenter" || e.type === "dragover"));
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsUploading(true);
    const uploaded: string[] = [];

    try {
      for (const file of files) {
        uploaded.push(await uploadImage(file));
      }
      onPhotosChange([...photos, ...uploaded]);
      toast.success(t("uploading", { count: uploaded.length }));
    } catch {
      // Anything already uploaded is kept: re-picking every photo because the
      // fourth one failed is worse than a partial success.
      if (uploaded.length > 0) onPhotosChange([...photos, ...uploaded]);
      toast.error(t("uploadError"));
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Extras beyond the cap were silently discarded, which reads as photos
   * failing to attach. They are still dropped — the server would refuse them —
   * but the person is told how many made it.
   */
  const acceptFiles = async (selected: FileList) => {
    const files = Array.from(selected);
    const accepted = files.slice(0, remaining);
    if (accepted.length < files.length) {
      toast.warning(t("tooMany", { count: accepted.length, max: MAX_PHOTOS }));
    }
    await uploadFiles(accepted);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (!isFull && e.dataTransfer.files?.length) {
      await acceptFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    if (input.files?.length) await acceptFiles(input.files);
    // Cleared so picking the same file twice still fires a change event.
    input.value = "";
  };

  const removePhoto = (index: number) =>
    onPhotosChange(photos.filter((_, i) => i !== index));

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
      />
      <input
        type="file"
        ref={cameraInputRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
      />

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isFull && fileInputRef.current?.click()}
        className={`group flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
          isFull
            ? "cursor-not-allowed border-border/50 bg-muted/20 opacity-60"
            : isDragActive
              ? "scale-[1.01] cursor-pointer border-primary bg-primary/5"
              : "cursor-pointer border-border/50 bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
        }`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background shadow-sm transition-transform duration-200 group-hover:scale-110">
          {isUploading ? (
            <LottieLoader width={30} height={30} />
          ) : (
            <Upload className="h-7 w-7 text-primary/80 group-hover:text-primary" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">{t("title")}</p>
          <p className="text-sm text-muted-foreground">
            {isFull ? t("full", { max: MAX_PHOTOS }) : t("subtitle")}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {t("count", { count: photos.length, max: MAX_PHOTOS })}
          </p>
        </div>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-4 md:grid-cols-5">
          {photos.map((photo, index) => (
            <div key={photo} className="group relative aspect-square">
              <div
                className="h-full w-full rounded-xl border border-border/50 bg-muted bg-cover bg-center shadow-sm"
                style={{ backgroundImage: `url('${photo}')` }}
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                aria-label={t("remove")}
                className="absolute -right-2 -top-2 rounded-full bg-destructive p-1.5 text-white opacity-0 shadow-md transition-all hover:scale-110 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!isFull && (
        <Button
          variant="outline"
          className="h-12 w-full gap-2 rounded-xl border-primary/20 text-primary transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isUploading}
        >
          <Camera className="h-5 w-5" />
          {t("takePhoto")}
        </Button>
      )}
    </div>
  );
}
