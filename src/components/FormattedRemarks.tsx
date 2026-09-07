"use client";

import { AlertCircle, Calendar } from "lucide-react";

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
    const suffixRegex = /(?:•|—|-)\s*(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}(?:.*))$/i;
    const suffixMatch = cleanText.match(suffixRegex);
    if (suffixMatch) {
      foundDate = formatRemarkDate(suffixMatch[1]);
      cleanText = cleanText.replace(suffixMatch[0], "").trim();
    }
  }

  const finalDate = foundDate || (defaultDate ? formatRemarkDate(defaultDate) : formatRemarkDate(new Date()));
  return { cleanText: cleanText || text, displayDate: finalDate };
}

interface FormattedRemarksProps {
  remarks?: string | null;
  textClass?: string;
  date?: string | Date | null;
}

export default function FormattedRemarks({ remarks, textClass = "text-xs", date }: FormattedRemarksProps) {
  if (!remarks) return null;

  // Split lines to handle separate remarks if they were appended with newlines
  const lines = remarks.split("\n");

  return (
    <div className="space-y-2 mt-1.5 w-full">
      {lines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();
        if (!trimmed) return null;

        // Match: [Flagged by CallerName (Role)]: message or [Flagged by CallerName (Role) • Date]: message
        const flagMatch = trimmed.match(/^\[Flagged by ([^\]]+)\]:\s*([\s\S]*)/i);
        if (flagMatch) {
          const [, callerInfo, msg] = flagMatch;
          let caller = callerInfo.trim();
          let flagDate = "";

          // Check if caller string has embedded date like "CallerName • Sep 1, 2026" or "CallerName on Sep 1, 2026"
          const splitDelim = caller.includes(" • ") ? " • " : caller.includes(" on ") ? " on " : caller.includes(" - ") ? " - " : null;
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
              className="p-3 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-200 flex flex-col gap-2 shadow-2xs text-left transition-all"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="inline-block font-bold text-[9px] uppercase bg-rose-100 dark:bg-rose-900/70 px-2 py-0.5 rounded text-rose-700 dark:text-rose-300 tracking-wider">
                    Flagged by {caller}
                  </span>
                </div>
                {finalFlagDate && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-rose-200/70 dark:border-rose-900/60 shadow-2xs">
                    <Calendar className="w-3 h-3 text-rose-500 dark:text-rose-400 shrink-0" />
                    {finalFlagDate}
                  </span>
                )}
              </div>
              <div className={`font-semibold ${textClass} text-rose-900 dark:text-rose-100 leading-relaxed`}>
                {cleanMsg}
              </div>
            </div>
          );
        }

        // Default layout for normal remarks
        const { cleanText, displayDate } = parseLineDate(trimmed, date);

        return (
          <div
            key={idx}
            className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-xl text-slate-700 dark:text-slate-200 flex flex-col gap-2 text-left transition-all"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="inline-block font-bold text-[9px] uppercase bg-slate-200/90 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-200 tracking-wider">
                Remarks
              </span>
              {displayDate && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                  <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-400 shrink-0" />
                  {displayDate}
                </span>
              )}
            </div>
            <div className={`font-medium ${textClass} text-slate-800 dark:text-slate-200 leading-relaxed`}>
              {cleanText}
            </div>
          </div>
        );
      })}
    </div>
  );
}
