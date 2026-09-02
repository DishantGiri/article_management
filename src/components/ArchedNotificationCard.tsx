"use client";

import React from "react";
import { X, ArrowRight, CheckCircle2 } from "lucide-react";
import { CategoryHornIcon, HornCategory } from "./CategoryHornIcon";

export interface ArchedNotificationProps {
  id?: number | string;
  category?: HornCategory | string;
  count?: number;
  title?: string;
  message: string;
  authorName?: string;
  createdAt?: string | Date;
  onClose?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  isAcknowledging?: boolean;
  type?: string;
  isModal?: boolean;
  showCloseButton?: boolean;
}

export function getCategoryConfig(category?: string, type?: string) {
  const normCategory = (category || "").toUpperCase();
  const normType = (type || "").toUpperCase();

  if (normCategory === "URGENT" || normType === "LINK_ISSUE") {
    return {
      hornCategory: "URGENT" as HornCategory,
      themeBg: "bg-[#FFF1F2] dark:bg-red-950/40",
      themeBorder: "border-red-200 dark:border-red-800/60",
      badgeText: "Urgent",
      badgeBg: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
      buttonBg: "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-red-500/30",
      accentColor: "#EF4444",
      defaultTitle: normType === "LINK_ISSUE" ? "Link Issue Alert" : "Urgent Notice",
    };
  }

  if (normCategory === "ANNOUNCEMENT" || normType === "PRODUCT_ADDED") {
    return {
      hornCategory: "ANNOUNCEMENT" as HornCategory,
      themeBg: "bg-[#EFF6FF] dark:bg-blue-950/40",
      themeBorder: "border-blue-200 dark:border-blue-800/60",
      badgeText: normType === "PRODUCT_ADDED" ? "Product" : "Announcement",
      badgeBg: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
      buttonBg: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/30",
      accentColor: "#3B82F6",
      defaultTitle: normType === "PRODUCT_ADDED" ? "New Product Added" : "Official Announcement",
    };
  }

  if (normCategory === "SUGGESTION" || normType === "ARTICLE_SUGGESTION") {
    return {
      hornCategory: "SUGGESTION" as HornCategory,
      themeBg: "bg-[#FAF5FF] dark:bg-purple-950/40",
      themeBorder: "border-purple-200 dark:border-purple-800/60",
      badgeText: "Suggestion",
      badgeBg: "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300",
      buttonBg: "bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 shadow-purple-500/30",
      accentColor: "#A855F7",
      defaultTitle: normType === "ARTICLE_SUGGESTION" ? "Article Suggestion" : "Team Suggestion",
    };
  }

  if (normCategory === "IMPORTANT" || normType === "APPROVAL_GRANTED") {
    return {
      hornCategory: "IMPORTANT" as HornCategory,
      themeBg: "bg-[#FFFBEB] dark:bg-amber-950/40",
      themeBorder: "border-amber-200 dark:border-amber-800/60",
      badgeText: normType === "APPROVAL_GRANTED" ? "Approved" : "Important",
      badgeBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
      buttonBg: "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/30",
      accentColor: "#F59E0B",
      defaultTitle: normType === "APPROVAL_GRANTED" ? "Approval Granted" : "Important Notice",
    };
  }

  // Default: GENERAL
  return {
    hornCategory: "GENERAL" as HornCategory,
    themeBg: "bg-[#F0FDF4] dark:bg-emerald-950/40",
    themeBorder: "border-emerald-200 dark:border-emerald-800/60",
    badgeText: "General",
    badgeBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    buttonBg: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/30",
    accentColor: "#10B981",
    defaultTitle: "Notice",
  };
}

export function ArchedNotificationCard({
  category,
  count = 1,
  title,
  message,
  authorName,
  createdAt,
  onClose,
  onAction,
  actionLabel = "View Details",
  isAcknowledging = false,
  type,
  showCloseButton = true,
}: ArchedNotificationProps) {
  const config = getCategoryConfig(category, type);
  const displayTitle = title || config.defaultTitle;

  return (
    <div className="relative w-full max-w-[340px] xs:max-w-[380px] sm:max-w-[420px] pt-12 sm:pt-14 select-none mx-auto">
      {/* Top Arched Dome Arch with Category Horn Icon */}
      <div className="absolute top-0 sm:-top-2 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
        {/* Outward Dome Circle Backing */}
        <div className="w-[88px] h-[88px] xs:w-[96px] xs:h-[96px] sm:w-[110px] sm:h-[110px] rounded-full bg-white dark:bg-slate-900 p-1.5 sm:p-2 shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-slate-200/70 dark:border-slate-800 flex items-center justify-center">
          {/* Inner Tinted Disc */}
          <div
            className={`w-full h-full rounded-full ${config.themeBg} flex items-center justify-center transition-colors duration-300 overflow-visible`}
          >
            <CategoryHornIcon
              category={config.hornCategory}
              count={count}
              size={54}
              className="sm:w-16 sm:h-16"
            />
          </div>
        </div>
      </div>

      {/* Main Card Body */}
      <div
        className={`relative bg-white dark:bg-slate-900 rounded-[24px] xs:rounded-[28px] sm:rounded-[36px] pt-12 sm:pt-14 pb-5 sm:pb-7 px-4 xs:px-6 sm:px-8 border border-slate-200/80 dark:border-slate-800 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.18)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-300`}
      >
        {/* Subtle Ambient Background Light */}
        <div
          className={`absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full ${config.themeBg} blur-3xl opacity-60 pointer-events-none`}
        />

        {/* Top-Right Circular Close Button (Only when enabled) */}
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer z-30 shadow-2xs"
            title="Dismiss"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
          </button>
        )}

        {/* Category Pill Tag */}
        <div className="flex justify-center mb-1 sm:mb-1.5">
          <span
            className={`text-[9px] xs:text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider px-2 sm:px-2.5 py-0.5 rounded-full ${config.badgeBg}`}
          >
            {config.badgeText}
          </span>
        </div>

        {/* Heading Title */}
        <h2 className="text-lg xs:text-xl sm:text-2xl font-black text-slate-900 dark:text-white text-center tracking-tight leading-snug break-words px-1">
          {displayTitle}
        </h2>

        {/* Content / Message Body with safe internal scrolling for longer notices */}
        <div className="mt-2 sm:mt-2.5 max-h-[160px] xs:max-h-[200px] sm:max-h-[240px] overflow-y-auto pr-1 text-center">
          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto break-words whitespace-pre-wrap">
            {message}
          </p>
        </div>

        {/* Author & Timestamp (if provided) */}
        {(authorName || createdAt) && (
          <div className="mt-2.5 sm:mt-3 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex-wrap">
            {authorName && (
              <span>
                Posted by <strong className="text-slate-600 dark:text-slate-300">{authorName}</strong>
              </span>
            )}
            {authorName && createdAt && <span>&bull;</span>}
            {createdAt && (
              <span>{typeof createdAt === "string" ? new Date(createdAt).toLocaleDateString() : createdAt.toLocaleDateString()}</span>
            )}
          </div>
        )}

        {/* Action Button */}
        {onAction && (
          <div className="mt-4 sm:mt-6 flex justify-center">
            <button
              onClick={onAction}
              disabled={isAcknowledging}
              className={`w-full max-w-[260px] py-2.5 xs:py-3 sm:py-3.5 px-4 sm:px-6 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm text-white ${config.buttonBg} flex items-center justify-center gap-2 shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
            >
              {isAcknowledging ? (
                <>
                  <CheckCircle2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
