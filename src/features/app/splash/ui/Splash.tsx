"use client";

import { useSplash } from "../hooks/useSplash";

export function Splash() {
  useSplash();

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-600 via-blue-700 to-blue-800 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo with animation */}
        <div className="relative">
          <div className="absolute inset-0 bg-white/20 rounded-3xl blur-xl animate-pulse" />
          {/* The app-icon treatment of the mark, at splash scale. */}
          <div className="relative bg-white rounded-3xl p-8 shadow-2xl animate-scale-in">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#08090B]">
              <span
                className="box-border block h-7 w-7"
                style={{
                  borderTop: "5px solid #FFFFFF",
                  borderRight: "5px solid #FFFFFF",
                  transform: "rotate(45deg) translate(-2px, 2px)",
                }}
              />
            </span>
          </div>
        </div>

        {/* Brand name */}
        <div className="text-center space-y-2 animate-fade-in-up">
          <h1 className="text-5xl font-bold text-white tracking-tight">
            EXPEDITOO
          </h1>
          <p className="text-blue-100 text-lg font-medium">
            Ship, Bid & Deliver
          </p>
        </div>

        {/* Loading indicator */}
        <div className="flex flex-col items-center gap-4 mt-8 animate-fade-in-up delay-300">
          <div className="flex gap-2">
            <div
              className="w-2.5 h-2.5 bg-white rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <div
              className="w-2.5 h-2.5 bg-white rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="w-2.5 h-2.5 bg-white rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>

        </div>
      </div>

      {/* Bottom decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-blue-900/50 to-transparent" />
    </div>
  );
}
