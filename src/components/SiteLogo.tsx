"use client";

import { useState, useEffect } from "react";
import { Globe } from "lucide-react";

interface SiteLogoProps {
  url?: string | null;
  name: string;
  className?: string;
  iconSize?: string;
}

export default function SiteLogo({
  url,
  name,
  className = "w-10 h-10",
  iconSize = "w-5 h-5",
}: SiteLogoProps) {
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Extract clean domain (e.g., "https://www.dailyhealthsupplements.com/path" -> "dailyhealthsupplements.com")
  const domain = url
    ? url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split("/")[0].trim()
    : null;

  useEffect(() => {
    setHasError(false);
    setLoaded(false);
  }, [url]);

  // Google Favicon service provides high quality (128px) favicons for domains
  const faviconUrl = domain && !hasError
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
    : null;

  if (!faviconUrl || hasError) {
    return (
      <div
        className={`${className} rounded-xl bg-[#6D8196]/15 border border-[#6D8196]/30 flex items-center justify-center text-[#3D4F61] shrink-0 font-bold text-xs shadow-2xs`}
        title={name}
      >
        {name ? name.substring(0, 2).toUpperCase() : <Globe className={iconSize} />}
      </div>
    );
  }

  return (
    <div
      className={`${className} rounded-xl bg-white border border-[#CBCBCB]/60 p-1 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden relative group-hover:border-[#6D8196]/50 transition-colors`}
      title={name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={faviconUrl}
        alt={`${name} logo`}
        className={`w-full h-full object-contain rounded-lg transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setHasError(true)}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#6D8196]/10 text-[#3D4F61]">
          <Globe className="w-4 h-4 animate-pulse opacity-60" />
        </div>
      )}
    </div>
  );
}
