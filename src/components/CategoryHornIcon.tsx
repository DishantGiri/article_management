"use client";

import React from "react";

export type HornCategory =
  | "IMPORTANT"
  | "URGENT"
  | "ANNOUNCEMENT"
  | "SUGGESTION"
  | "GENERAL"
  | "LINK_ISSUE"
  | "ARTICLE_SUGGESTION"
  | "APPROVAL_GRANTED"
  | "PRODUCT_ADDED";

interface CategoryHornIconProps {
  category: HornCategory | string;
  count?: number;
  className?: string;
  size?: number;
}

export function CategoryHornIcon({
  category,
  count = 1,
  className = "",
  size = 72,
}: CategoryHornIconProps) {
  const normCategory = (category || "IMPORTANT").toUpperCase();

  // Pick category styling & 3D SVG representation
  switch (normCategory) {
    case "URGENT":
    case "LINK_ISSUE":
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_8px_16px_rgba(239,68,68,0.35)] transform -rotate-12 hover:rotate-0 transition-transform duration-300"
          >
            <defs>
              <linearGradient id="urgentHornBody" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF6B6B" />
                <stop offset="0.4" stopColor="#EE1C24" />
                <stop offset="0.8" stopColor="#B91C1C" />
                <stop offset="1" stopColor="#7F1D1D" />
              </linearGradient>
              <linearGradient id="urgentHornRim" x1="45" y1="20" x2="85" y2="85" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FCA5A5" />
                <stop offset="0.5" stopColor="#EF4444" />
                <stop offset="1" stopColor="#991B1B" />
              </linearGradient>
              <linearGradient id="urgentHighlight" x1="30" y1="30" x2="60" y2="45" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFFFFF" stopOpacity="0.8" />
                <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="urgentGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#F87171" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Ambient Background Glow */}
            <circle cx="50" cy="50" r="42" fill="url(#urgentGlow)" />

            {/* Megaphone Handle */}
            <path
              d="M32 58L22 75C21 77 22.5 79.5 25 79.5H31C33 79.5 34.5 78 35.5 76L42 63"
              fill="#991B1B"
              stroke="#7F1D1D"
              strokeWidth="2"
            />
            {/* Handle Grip Detail */}
            <path d="M25 73L33 73" stroke="#FCA5A5" strokeWidth="1.5" strokeLinecap="round" />

            {/* Megaphone Main Cone */}
            <path
              d="M30 40C30 36 34 33 38 34L72 24C75 23 78 25.5 78 29V67C78 70.5 75 73 72 72L38 62C34 63 30 60 30 56V40Z"
              fill="url(#urgentHornBody)"
            />

            {/* Specular curved highlight on cone */}
            <path
              d="M36 41L70 30C72 29.5 74 30.5 74 32.5V36L36 46V41Z"
              fill="url(#urgentHighlight)"
            />

            {/* Megaphone Big Bell Opening Rim */}
            <ellipse
              cx="78"
              cy="48"
              rx="7"
              ry="21"
              fill="url(#urgentHornRim)"
              stroke="#FEE2E2"
              strokeWidth="1.5"
            />
            {/* Inner mouth depth */}
            <ellipse cx="78" cy="48" rx="4" ry="17" fill="#5F0D0D" />

            {/* Back Speaker / Driver Cap */}
            <path
              d="M30 38C26 38 23 42 23 48C23 54 26 58 30 58V38Z"
              fill="#B91C1C"
              stroke="#FCA5A5"
              strokeWidth="1"
            />

            {/* Sound Wave Pulses */}
            <path
              d="M87 38C90 43 90 53 87 58"
              stroke="#EF4444"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="2 1"
            />
            <path
              d="M93 32C98 40 98 56 93 64"
              stroke="#F87171"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>

          {/* Badge Counter */}
          {count > 0 && (
            <div className="absolute -top-1 -right-1 bg-gradient-to-tr from-red-600 to-rose-500 text-white font-extrabold text-[11px] sm:text-xs min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md animate-scaleIn">
              {count}
            </div>
          )}
        </div>
      );

    case "ANNOUNCEMENT":
    case "PRODUCT_ADDED":
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_8px_16px_rgba(37,99,235,0.35)] transform -rotate-6 hover:rotate-0 transition-transform duration-300"
          >
            <defs>
              <linearGradient id="blueHornBody" x1="15" y1="20" x2="85" y2="85" gradientUnits="userSpaceOnUse">
                <stop stopColor="#60A5FA" />
                <stop offset="0.35" stopColor="#2563EB" />
                <stop offset="0.8" stopColor="#1D4ED8" />
                <stop offset="1" stopColor="#1E3A8A" />
              </linearGradient>
              <linearGradient id="blueHornRim" x1="50" y1="20" x2="85" y2="80" gradientUnits="userSpaceOnUse">
                <stop stopColor="#93C5FD" />
                <stop offset="0.5" stopColor="#3B82F6" />
                <stop offset="1" stopColor="#1E40AF" />
              </linearGradient>
              <linearGradient id="blueHighlight" x1="30" y1="30" x2="70" y2="45" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFFFFF" stopOpacity="0.85" />
                <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Ambient Background Glow */}
            <circle cx="50" cy="50" r="42" fill="#3B82F6" fillOpacity="0.15" />

            {/* Handle */}
            <path
              d="M32 58L22 75C21 77 22.5 79.5 25 79.5H31C33 79.5 34.5 78 35.5 76L42 63"
              fill="#1E3A8A"
              stroke="#172554"
              strokeWidth="2"
            />

            {/* Horn Body Cone */}
            <path
              d="M30 40C30 36 34 33 38 34L72 24C75 23 78 25.5 78 29V67C78 70.5 75 73 72 72L38 62C34 63 30 60 30 56V40Z"
              fill="url(#blueHornBody)"
            />

            {/* Specular Highlight */}
            <path
              d="M36 41L70 30C72 29.5 74 30.5 74 32.5V36L36 46V41Z"
              fill="url(#blueHighlight)"
            />

            {/* Outer Rim */}
            <ellipse
              cx="78"
              cy="48"
              rx="7"
              ry="21"
              fill="url(#blueHornRim)"
              stroke="#DBEAFE"
              strokeWidth="1.5"
            />
            <ellipse cx="78" cy="48" rx="4" ry="17" fill="#0F172A" />

            {/* Back Cap */}
            <path
              d="M30 38C26 38 23 42 23 48C23 54 26 58 30 58V38Z"
              fill="#1D4ED8"
              stroke="#93C5FD"
              strokeWidth="1"
            />

            {/* Broadcast Sound Waves */}
            <path
              d="M87 38C90 43 90 53 87 58"
              stroke="#3B82F6"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M93 32C98 40 98 56 93 64"
              stroke="#60A5FA"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>

          {/* Badge Counter */}
          {count > 0 && (
            <div className="absolute -top-1 -right-1 bg-gradient-to-tr from-red-600 to-rose-500 text-white font-extrabold text-[11px] sm:text-xs min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md animate-scaleIn">
              {count}
            </div>
          )}
        </div>
      );

    case "SUGGESTION":
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_8px_16px_rgba(147,51,234,0.35)] transform -rotate-8 hover:rotate-0 transition-transform duration-300"
          >
            <defs>
              <linearGradient id="purpleHornBody" x1="15" y1="20" x2="85" y2="85" gradientUnits="userSpaceOnUse">
                <stop stopColor="#C084FC" />
                <stop offset="0.35" stopColor="#9333EA" />
                <stop offset="0.8" stopColor="#7E22CE" />
                <stop offset="1" stopColor="#581C87" />
              </linearGradient>
              <linearGradient id="purpleHornRim" x1="50" y1="20" x2="85" y2="80" gradientUnits="userSpaceOnUse">
                <stop stopColor="#E9D5FF" />
                <stop offset="0.5" stopColor="#A855F7" />
                <stop offset="1" stopColor="#6B21A8" />
              </linearGradient>
              <linearGradient id="purpleHighlight" x1="30" y1="30" x2="70" y2="45" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFFFFF" stopOpacity="0.85" />
                <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
            </defs>

            <circle cx="50" cy="50" r="42" fill="#A855F7" fillOpacity="0.15" />

            {/* Handle */}
            <path
              d="M32 58L22 75C21 77 22.5 79.5 25 79.5H31C33 79.5 34.5 78 35.5 76L42 63"
              fill="#581C87"
              stroke="#3B0764"
              strokeWidth="2"
            />

            {/* Body */}
            <path
              d="M30 40C30 36 34 33 38 34L72 24C75 23 78 25.5 78 29V67C78 70.5 75 73 72 72L38 62C34 63 30 60 30 56V40Z"
              fill="url(#purpleHornBody)"
            />

            {/* Specular */}
            <path
              d="M36 41L70 30C72 29.5 74 30.5 74 32.5V36L36 46V41Z"
              fill="url(#purpleHighlight)"
            />

            {/* Rim */}
            <ellipse
              cx="78"
              cy="48"
              rx="7"
              ry="21"
              fill="url(#purpleHornRim)"
              stroke="#F3E8FF"
              strokeWidth="1.5"
            />
            <ellipse cx="78" cy="48" rx="4" ry="17" fill="#2E1065" />

            {/* Back Cap */}
            <path
              d="M30 38C26 38 23 42 23 48C23 54 26 58 30 58V38Z"
              fill="#7E22CE"
              stroke="#E9D5FF"
              strokeWidth="1"
            />

            {/* Sparkle Icons */}
            <path
              d="M87 34L88.5 30L90 34L94 35.5L90 37L88.5 41L87 37L83 35.5L87 34Z"
              fill="#F0ABFC"
            />
            <path
              d="M91 55L92 52L93 55L96 56L93 57L92 60L91 57L88 56L91 55Z"
              fill="#E879F9"
            />
          </svg>

          {/* Badge Counter */}
          {count > 0 && (
            <div className="absolute -top-1 -right-1 bg-gradient-to-tr from-red-600 to-rose-500 text-white font-extrabold text-[11px] sm:text-xs min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md animate-scaleIn">
              {count}
            </div>
          )}
        </div>
      );

    case "GENERAL":
    case "APPROVAL_GRANTED":
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_8px_16px_rgba(16,185,129,0.35)] transform -rotate-6 hover:rotate-0 transition-transform duration-300"
          >
            <defs>
              <linearGradient id="emeraldHornBody" x1="15" y1="20" x2="85" y2="85" gradientUnits="userSpaceOnUse">
                <stop stopColor="#34D399" />
                <stop offset="0.35" stopColor="#10B981" />
                <stop offset="0.8" stopColor="#059669" />
                <stop offset="1" stopColor="#064E3B" />
              </linearGradient>
              <linearGradient id="emeraldHornRim" x1="50" y1="20" x2="85" y2="80" gradientUnits="userSpaceOnUse">
                <stop stopColor="#A7F3D0" />
                <stop offset="0.5" stopColor="#10B981" />
                <stop offset="1" stopColor="#047857" />
              </linearGradient>
              <linearGradient id="emeraldHighlight" x1="30" y1="30" x2="70" y2="45" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFFFFF" stopOpacity="0.85" />
                <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
            </defs>

            <circle cx="50" cy="50" r="42" fill="#10B981" fillOpacity="0.15" />

            {/* Handle */}
            <path
              d="M32 58L22 75C21 77 22.5 79.5 25 79.5H31C33 79.5 34.5 78 35.5 76L42 63"
              fill="#064E3B"
              stroke="#022C22"
              strokeWidth="2"
            />

            {/* Body */}
            <path
              d="M30 40C30 36 34 33 38 34L72 24C75 23 78 25.5 78 29V67C78 70.5 75 73 72 72L38 62C34 63 30 60 30 56V40Z"
              fill="url(#emeraldHornBody)"
            />

            {/* Specular */}
            <path
              d="M36 41L70 30C72 29.5 74 30.5 74 32.5V36L36 46V41Z"
              fill="url(#emeraldHighlight)"
            />

            {/* Rim */}
            <ellipse
              cx="78"
              cy="48"
              rx="7"
              ry="21"
              fill="url(#emeraldHornRim)"
              stroke="#D1FAE5"
              strokeWidth="1.5"
            />
            <ellipse cx="78" cy="48" rx="4" ry="17" fill="#022C22" />

            {/* Back Cap */}
            <path
              d="M30 38C26 38 23 42 23 48C23 54 26 58 30 58V38Z"
              fill="#059669"
              stroke="#A7F3D0"
              strokeWidth="1"
            />

            {/* Sound Waves */}
            <path
              d="M87 38C90 43 90 53 87 58"
              stroke="#10B981"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M93 32C98 40 98 56 93 64"
              stroke="#34D399"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>

          {/* Badge Counter */}
          {count > 0 && (
            <div className="absolute -top-1 -right-1 bg-gradient-to-tr from-red-600 to-rose-500 text-white font-extrabold text-[11px] sm:text-xs min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md animate-scaleIn">
              {count}
            </div>
          )}
        </div>
      );

    case "IMPORTANT":
    case "ARTICLE_SUGGESTION":
    default:
      // 3D Golden Bell / Horn (Exact match to User Reference Image!)
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_10px_20px_rgba(234,179,8,0.4)] transform -rotate-12 hover:rotate-0 transition-transform duration-300"
          >
            <defs>
              {/* 3D Bell Warm Shading Gradient */}
              <linearGradient id="goldBellBody" x1="25" y1="15" x2="75" y2="85" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FDE047" />
                <stop offset="0.3" stopColor="#EAB308" />
                <stop offset="0.65" stopColor="#CA8A04" />
                <stop offset="0.9" stopColor="#A16207" />
                <stop offset="1" stopColor="#713F12" />
              </linearGradient>

              {/* Bell Specular Lighting */}
              <linearGradient id="goldBellHighlight" x1="38" y1="20" x2="62" y2="55" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFFFFF" stopOpacity="0.95" />
                <stop offset="0.5" stopColor="#FEF08A" stopOpacity="0.5" />
                <stop offset="1" stopColor="#EAB308" stopOpacity="0" />
              </linearGradient>

              {/* Bottom Rim Gradient */}
              <linearGradient id="goldBellRim" x1="20" y1="65" x2="80" y2="85" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FEF08A" />
                <stop offset="0.4" stopColor="#EAB308" />
                <stop offset="0.8" stopColor="#A16207" />
                <stop offset="1" stopColor="#451A03" />
              </linearGradient>

              {/* Bell Interior Depth */}
              <radialGradient id="bellMouthDepth" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#854D0E" />
                <stop offset="70%" stopColor="#451A03" />
                <stop offset="100%" stopColor="#1C0A00" />
              </radialGradient>
            </defs>

            {/* Ambient Background Warm Glow */}
            <circle cx="50" cy="50" r="42" fill="#EAB308" fillOpacity="0.15" />

            {/* Bell Top Handle / Loop */}
            <path
              d="M45 22C45 18 47.5 15 50 15C52.5 15 55 18 55 22"
              stroke="#A16207"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <path
              d="M46 22C46 19 48 17 50 17C52 17 54 19 54 22"
              stroke="#FEF08A"
              strokeWidth="1.5"
              strokeLinecap="round"
            />

            {/* Main 3D Bell Body */}
            <path
              d="M50 20C40 20 37 32 35 46C34 54 28 64 24 70C23 71.5 24 74 26 74H74C76 74 77 71.5 76 70C72 64 66 54 65 46C63 32 60 20 50 20Z"
              fill="url(#goldBellBody)"
            />

            {/* Specular 3D Reflection along curved side */}
            <path
              d="M50 22C44 22 41 31 39 44C38 52 35 59 32 65C30 68 32 70 34 70C38 64 42 54 44 44C46 32 47 23 50 22Z"
              fill="url(#goldBellHighlight)"
            />

            {/* Bell Clapper / Inner Ball */}
            <ellipse cx="50" cy="74" rx="7" ry="6" fill="#854D0E" />
            <circle cx="50" cy="76" r="5" fill="#CA8A04" />
            <circle cx="48.5" cy="74.5" r="1.5" fill="#FEF08A" />

            {/* Bell Bottom Flared Lip / Rim */}
            <path
              d="M24 70C28 67 38 65 50 65C62 65 72 67 76 70C77 71 76 73 74 74C68 77 58 79 50 79C42 79 32 77 26 74C24 73 23 71 24 70Z"
              fill="url(#goldBellRim)"
            />

            {/* Inner rim glow */}
            <ellipse cx="50" cy="72" rx="22" ry="4" fill="url(#bellMouthDepth)" opacity="0.6" />
          </svg>

          {/* Badge Counter */}
          {count > 0 && (
            <div className="absolute -top-1 -right-1 bg-gradient-to-tr from-red-600 to-rose-500 text-white font-extrabold text-[11px] sm:text-xs min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md animate-scaleIn">
              {count}
            </div>
          )}
        </div>
      );
  }
}
