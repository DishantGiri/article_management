"use client";

import { useState, useEffect } from "react";

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
}: SiteLogoProps) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  let hostname = "";
  try {
    if (url) {
      const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
      hostname = parsed.hostname;
    }
  } catch {
    hostname = url ? url.replace(/^(?:https?:\/\/)?/i, "").split("/")[0].trim() : "";
  }

  // Construct prioritized candidate sources for the logo
  const candidates: string[] = [];
  if (hostname) {
    const cleanHost = hostname.replace(/^www\./, "");
    // 1. DuckDuckGo with www (most reliable for WordPress / custom sites)
    candidates.push(`https://icons.duckduckgo.com/ip3/www.${cleanHost}.ico`);
    // 2. DuckDuckGo without www
    candidates.push(`https://icons.duckduckgo.com/ip3/${cleanHost}.ico`);
    // 3. Direct domain favicon
    if (url && url.startsWith("http")) {
      candidates.push(`${url.replace(/\/$/, "")}/favicon.ico`);
    }
    // 4. Google Favicon service
    candidates.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`);
  }

  useEffect(() => {
    setSourceIndex(0);
    setHasError(false);
    setLoaded(false);
  }, [url]);

  const currentSrc = candidates[sourceIndex];

  const handleImgError = () => {
    if (sourceIndex + 1 < candidates.length) {
      setSourceIndex((prev) => prev + 1);
      setLoaded(false);
    } else {
      setHasError(true);
    }
  };

  const initials = (name || "S").trim().slice(0, 3).toUpperCase();

  if (!currentSrc || hasError) {
    return (
      <div
        className={`${className} rounded-2xl bg-gradient-to-br from-[#6D8196] to-[#4A4A4A] border border-white/20 flex items-center justify-center text-white shrink-0 font-extrabold text-sm tracking-wider shadow-sm select-none`}
        title={name}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`${className} rounded-2xl bg-white dark:bg-slate-800 border border-[#CBCBCB]/60 dark:border-slate-700 p-2 flex items-center justify-center shrink-0 shadow-xs overflow-hidden relative`}
      title={name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={currentSrc}
        src={currentSrc}
        alt={`${name} logo`}
        className={`w-full h-full object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={handleImgError}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-[#6D8196] font-extrabold text-xs">
          {initials}
        </div>
      )}
    </div>
  );
}
