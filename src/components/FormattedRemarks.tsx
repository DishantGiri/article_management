"use client";

import { useState } from "react";
import { AlertCircle, Calendar, ExternalLink, Copy, Check, Link2 } from "lucide-react";
import { toast } from "react-hot-toast";

export function formatRemarkDate(val?: string | Date | null): string {
  if (!val) return "";
  try {
    const d = typeof val === "string" ? new Date(val) : val;
    if (isNaN(d.getTime())) return String(val);

    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;

    if (hasTime) {
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }

    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return String(val);
  }
}

// Helper to extract embedded date in text line if present
function parseLineDate(text: string, defaultDate?: string | Date | null): { cleanText: string; displayDate: string } {
  let cleanText = text.trim();
  let foundDate = "";

  // Check for: [YYYY-MM-DD] or [MMM D, YYYY] prefix/suffix
  const bracketDateRegex = /\[(\d{4}-\d{2}-\d{2}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}(?:[^\],]*))\s*\]/i;
  const match = cleanText.match(bracketDateRegex);
  if (match) {
    foundDate = formatRemarkDate(match[1]);
    cleanText = cleanText.replace(match[0], "").trim();
  }

  // Check for: (Date: ...) or (Sep 1, 2026)
  if (!foundDate) {
    const parenDateRegex = /\((?:Date:\s*)?(\d{4}-\d{2}-\d{2}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}(?:[^\),]*))\s*\)/i;
    const parenMatch = cleanText.match(parenDateRegex);
    if (parenMatch) {
      foundDate = formatRemarkDate(parenMatch[1]);
      cleanText = cleanText.replace(parenMatch[0], "").trim();
    }
  }

  // Check for: • Sep 1, 2026 or - Sep 1, 2026 at end
  if (!foundDate) {
    const suffixRegex = /(?:•|-|-)\s*(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}(?:.*))$/i;
    const suffixMatch = cleanText.match(suffixRegex);
    if (suffixMatch) {
      foundDate = formatRemarkDate(suffixMatch[1]);
      cleanText = cleanText.replace(suffixMatch[0], "").trim();
    }
  }

  const finalDate = foundDate || (defaultDate ? formatRemarkDate(defaultDate) : "");
  return { cleanText: cleanText || text, displayDate: finalDate };
}

function ensureExternalUrl(url: string) {
  if (!url) return "";
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// Render text with clickable URLs
function RichRemarkText({ text, textClass }: { text: string; textClass?: string }) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const trimmed = text.trim();
  const isPureUrl = /^(https?:\/\/[^\s]+|www\.[^\s]+)$/i.test(trimmed);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success("Link copied!");
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  if (isPureUrl) {
    const externalHref = ensureExternalUrl(trimmed);
    return (
      <div className="flex items-center gap-2 flex-wrap p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 shadow-2xs">
        <Link2 className="w-3.5 h-3.5 text-[#6D8196] dark:text-sky-400 shrink-0" />
        <a
          href={externalHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono font-bold text-[#6D8196] dark:text-sky-400 hover:text-slate-900 dark:hover:text-white hover:underline truncate max-w-sm flex items-center gap-1"
          title={trimmed}
        >
          <span>{trimmed}</span>
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
        <button
          type="button"
          onClick={() => handleCopy(externalHref)}
          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition ml-auto cursor-pointer"
          title="Copy URL"
        >
          {copiedUrl === externalHref ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    );
  }

  // Regex to detect inline URLs
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = text.split(urlRegex);

  return (
    <div className={`whitespace-pre-wrap leading-relaxed ${textClass || "text-xs font-medium"}`}>
      {parts.map((part, i) => {
        if (/^(https?:\/\/[^\s]+|www\.[^\s]+)$/i.test(part)) {
          const externalHref = ensureExternalUrl(part);
          return (
            <a
              key={i}
              href={externalHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[#6D8196] dark:text-sky-400 font-bold hover:underline mx-0.5 underline-offset-2"
            >
              <span>{part}</span>
              <ExternalLink className="w-3 h-3 inline" />
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

interface FormattedRemarksProps {
  remarks?: string | null;
  textClass?: string;
  date?: string | Date | null;
  defaultBadgeTitle?: string;
}

export default function FormattedRemarks({
  remarks,
  textClass = "text-xs",
  date,
  defaultBadgeTitle = "Remarks",
}: FormattedRemarksProps) {
  if (!remarks || !remarks.trim()) return null;

  // Split lines to handle separate remarks if they were appended with newlines or " | "
  const rawSegments = remarks
    .split("\n")
    .flatMap((line) => {
      if (/^https?:\/\//i.test(line.trim())) return [line];
      return line.split(/\s+\|\s+/);
    })
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawSegments.length === 0) return null;

  return (
    <div className="space-y-2.5 w-full">
      {rawSegments.map((segment, idx) => {
        // Match: [Flagged by CallerName (Role)]: message or [Flagged by CallerName (Role) • Date]: message
        const flagMatch = segment.match(/^\[Flagged by ([^\]]+)\]:\s*([\s\S]*)/i);
        if (flagMatch) {
          const [, callerInfo, msg] = flagMatch;
          let caller = callerInfo.trim();
          let flagDate = "";

          const splitDelim = caller.includes(" • ")
            ? " • "
            : caller.includes(" on ")
            ? " on "
            : caller.includes(" - ")
            ? " - "
            : null;
          if (splitDelim) {
            const parts = caller.split(splitDelim);
            caller = parts[0].trim();
            flagDate = formatRemarkDate(parts.slice(1).join(splitDelim).trim());
          }

          const { cleanText: cleanMsg, displayDate: parsedMsgDate } = parseLineDate(msg, date);
          const finalFlagDate = flagDate || parsedMsgDate;

          return (
            <div
              key={idx}
              className="p-3.5 bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded-xl text-rose-900 dark:text-rose-100 flex flex-col gap-2 shadow-2xs text-left transition-all"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="inline-block font-extrabold text-[9px] uppercase bg-rose-100 dark:bg-rose-900/70 px-2 py-0.5 rounded text-rose-800 dark:text-rose-300 tracking-wider">
                    Flagged by {caller}
                  </span>
                </div>
                {finalFlagDate && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-rose-200/70 dark:border-rose-900/60 shadow-2xs">
                    <Calendar className="w-3 h-3 text-rose-500 dark:text-rose-400 shrink-0" />
                    {finalFlagDate}
                  </span>
                )}
              </div>
              <RichRemarkText text={cleanMsg} textClass={`text-rose-950 dark:text-rose-100 font-semibold ${textClass}`} />
            </div>
          );
        }

        // Default layout for normal remarks with high contrast text and background
        const { cleanText, displayDate } = parseLineDate(segment, date);

        return (
          <div
            key={idx}
            className="p-3.5 bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-750 rounded-xl text-slate-800 dark:text-slate-100 flex flex-col gap-2 text-left shadow-2xs transition-all"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="inline-block font-extrabold text-[9px] uppercase bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 tracking-wider">
                {defaultBadgeTitle}
              </span>
              {displayDate && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                  <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-400 shrink-0" />
                  {displayDate}
                </span>
              )}
            </div>
            <RichRemarkText text={cleanText} textClass={`text-slate-800 dark:text-slate-100 ${textClass}`} />
          </div>
        );
      })}
    </div>
  );
}
