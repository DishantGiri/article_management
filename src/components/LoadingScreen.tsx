"use client";

import React from "react";
import Image from "next/image";

interface LoadingProps {
  message?: string;
  subtext?: string;
  size?: "sm" | "md" | "lg" | "xl";
  fullScreen?: boolean;
  className?: string;
}

export default function LoadingScreen({
  message = "Loading...",
  subtext,
  size = "md",
  fullScreen = false,
  className = "",
}: LoadingProps) {
  const sizeClasses = {
    sm: "w-28 h-20 max-w-[130px]",
    md: "w-52 h-40 max-w-[240px]",
    lg: "w-72 h-52 max-w-[300px]",
    xl: "w-96 h-64 max-w-[380px]",
  };

  const content = (
    <div
      className={`flex flex-col items-center justify-center text-center p-6 select-none animate-fadeIn ${className}`}
      suppressHydrationWarning
    >
      <div className="relative flex items-center justify-center" suppressHydrationWarning>
        {/* Animated SVG illustration */}
        <Image
          src="/loading.svg"
          alt="Loading..."
          width={240}
          height={180}
          className={`${sizeClasses[size]} object-contain drop-shadow-xs`}
          loading="eager"
          priority
          unoptimized
        />
      </div>

      {message && (
        <div className="mt-3 space-y-1" suppressHydrationWarning>
          <p className="text-xs font-bold text-[#4A4A4A] tracking-wider uppercase" suppressHydrationWarning>
            {message}
          </p>
          {subtext && (
            <p className="text-[11px] font-medium text-slate-400 max-w-xs mx-auto" suppressHydrationWarning>
              {subtext}
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-50 bg-[#FAF9F5]/90 backdrop-blur-xs flex items-center justify-center"
        suppressHydrationWarning
      >
        {content}
      </div>
    );
  }

  return content;
}
