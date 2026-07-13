"use client";

import { AlertCircle } from "lucide-react";

interface FormattedRemarksProps {
  remarks?: string | null;
  textClass?: string;
}

export default function FormattedRemarks({ remarks, textClass = "text-xs" }: FormattedRemarksProps) {
  if (!remarks) return null;

  // Split lines to handle separate remarks if they were appended with newlines
  const lines = remarks.split('\n');

  return (
    <div className="space-y-1.5 mt-1.5 w-full">
      {lines.map((line, idx) => {
        if (!line.trim()) return null;
        
        // Match: [Flagged by CallerName (Role)]: message
        const flagMatch = line.match(/^\[Flagged by ([^\]]+)\]:\s*([\s\S]*)/);
        if (flagMatch) {
          const [, caller, msg] = flagMatch;
          return (
            <div 
              key={idx} 
              className="p-2 bg-rose-50/70 border border-rose-100/50 rounded-xl text-rose-800 flex items-start gap-1.5 shadow-sm text-left"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="inline-block font-bold text-[9px] uppercase bg-rose-100/80 px-1.5 py-0.5 rounded text-rose-700 mr-1.5 tracking-wider">
                  Flagged by {caller}
                </span>
                <span className={`font-semibold ${textClass}`}>{msg}</span>
              </div>
            </div>
          );
        }

        // Default layout for normal remarks
        return (
          <div 
            key={idx} 
            className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 flex items-start gap-1.5 text-left"
          >
            <div className="flex-1">
              <span className="inline-block font-bold text-[9px] uppercase bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-700 mr-1.5 tracking-wider">
                Remarks
              </span>
              <span className={`font-medium ${textClass}`}>{line}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
