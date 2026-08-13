"use client";

import { useState, useRef } from "react";
import { Receipt, X } from "lucide-react";
import { InlineLoader } from "@/components/ui/page-loader";

import { processSlip } from "../api";
import { useTranslations } from "next-intl";

interface PurchaseSlipUploaderProps {
  onSlipProcessed: (data: {
    dimensions?: { length: number; width: number; height: number };
    weight?: string;
    price?: number;
    description?: string;
  }) => void;
  onError?: (error: string) => void;
}

export function PurchaseSlipUploader({
  onSlipProcessed,
  onError,
}: PurchaseSlipUploaderProps) {
  const t = useTranslations("create.slip");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedSlip, setUploadedSlip] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      onError?.(t("invalidFile"));
      return;
    }

    setIsUploading(true);
    const imageUrl = URL.createObjectURL(file);
    setUploadedSlip(imageUrl);

    try {
      // Convert file to base64 for API
      const base64 = await fileToBase64(file);

      // Call AI processing API
      const data = await processSlip(base64);
      onSlipProcessed(data);
    } catch (error) {
      console.error("Error processing slip:", error);
      onError?.(error instanceof Error ? error.message : t("processError"));
    } finally {
      setIsUploading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:image/...;base64, prefix if present
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const removeSlip = () => {
    if (uploadedSlip) {
      URL.revokeObjectURL(uploadedSlip);
    }
    setUploadedSlip(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-3 group ${isUploading
          ? "border-primary bg-primary/5"
          : "border-border/50 bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
          }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFileSelect(file);
            }
          }}
        />

        {isUploading ? (
          <>
            <InlineLoader size="md" />
          </>
        ) : uploadedSlip ? (
          <div className="relative w-full">
            <img
              src={uploadedSlip}
              alt="Uploaded slip"
              className="w-full h-48 object-contain rounded-lg"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeSlip();
              }}
              className="absolute -top-2 -right-2 p-1.5 bg-destructive text-white rounded-full shadow-md hover:scale-110 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-background shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
              <Receipt className="w-6 h-6 text-primary/80 group-hover:text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                {t("title")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("subtitle")}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

