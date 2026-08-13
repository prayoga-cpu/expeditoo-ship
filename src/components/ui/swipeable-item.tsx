"use client";

import React, { useState, useRef, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeableItemProps {
  children: React.ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
  className?: string;
  disabled?: boolean;
}

const DELETE_THRESHOLD = -40; // Minimum swipe to show delete button
const DELETE_WIDTH = 80; // Width of delete button

/**
 * SwipeableItem - Swipe left to reveal delete button
 * Works on both touch and mouse devices
 */
export function SwipeableItem({
  children,
  onDelete,
  deleteLabel = "Delete",
  className,
  contentClassName,
  disabled = false,
}: SwipeableItemProps & { contentClassName?: string }) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startTranslateX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasDraggedRef = useRef(false); // Track if actual dragging occurred


  const startY = useRef(0); // Track vertical start position
  const isHorizontalSwipe = useRef(false); // Track if this is a horizontal swipe

  const handleStart = useCallback(
    (clientX: number, clientY?: number) => {
      if (disabled) return;
      startX.current = clientX;
      startY.current = clientY ?? 0;
      startTranslateX.current = translateX;
      hasDraggedRef.current = false; // Reset drag flag
      isHorizontalSwipe.current = false; // Reset swipe direction flag
      setIsDragging(true);
    },
    [disabled, translateX]
  );

  const handleMove = useCallback(
    (clientX: number, clientY?: number) => {
      if (!isDragging || disabled) return;

      const diffX = clientX - startX.current;
      const diffY = clientY !== undefined ? clientY - startY.current : 0;

      // Determine swipe direction on first significant movement
      if (!isHorizontalSwipe.current && !hasDraggedRef.current) {
        if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
          isHorizontalSwipe.current = true;
        } else if (Math.abs(diffY) > 10) {
          // This is a vertical scroll, cancel the swipe
          setIsDragging(false);
          return;
        }
      }

      // Only consider it a drag if moved more than slight jitter
      if (Math.abs(diffX) > 5) {
        hasDraggedRef.current = true;
      }

      // Calculate new position
      const newTranslate = Math.max(
        Math.min(startTranslateX.current + diffX, 0),
        -DELETE_WIDTH
      );
      setTranslateX(newTranslate);
    },
    [isDragging, disabled]
  );

  const handleEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    isHorizontalSwipe.current = false;

    // Logic to snap open or close
    if (translateX < DELETE_THRESHOLD) {
      setTranslateX(-DELETE_WIDTH);
    } else {
      setTranslateX(0);
    }

    // Note: We don't reset hasDraggedRef here because we need it in the onClick handler
    // It will be reset on next handleStart
  }, [isDragging, translateX]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Prevent vertical scroll when doing horizontal swipe
    if (isHorizontalSwipe.current) {
      e.preventDefault();
    }
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't preventDefault here to allow clicks to propagate if not dragging
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault(); // Prevent selection text during drag
    handleMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      handleEnd();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setTranslateX(-300); // Animate out
    setTimeout(() => {
      onDelete();
      // Reset position after delete (if the item isn't removed from DOM immediately)
      // or if the component is reused
      setTimeout(() => setTranslateX(0), 100);
    }, 200);
  };

  const handleContentClick = (e: React.MouseEvent) => {
    // If we just finished dragging/swiping, ignore this click (don't navigate or close)
    if (hasDraggedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      // Reset flag after consuming the event
      hasDraggedRef.current = false;
      return;
    }

    // If item is open (and not dragging), this click is meant to close it
    if (translateX < 0) {
      e.stopPropagation();
      e.preventDefault();
      setTranslateX(0);
    }

    // Otherwise (item closed, no drag), let event bubble to children (e.g., navigation)
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden select-none touch-pan-y", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Delete button background */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end bg-destructive"
        style={{ width: DELETE_WIDTH }}
      >
        <button
          onClick={handleDelete}
          className="h-full w-full flex items-center justify-center text-white gap-1 px-3 hover:bg-destructive/90 transition-colors"
          tabIndex={translateX < 0 ? 0 : -1} // Prevent tab focus when hidden
          aria-hidden={translateX === 0}
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-xs font-medium">{deleteLabel}</span>
        </button>
      </div>

      {/* Main content */}
      <div
        className={cn(
          "relative bg-background transition-transform",
          isDragging ? "transition-none" : "duration-200",
          contentClassName
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onClick={handleContentClick}
      >
        {children}
      </div>
    </div>
  );
}


