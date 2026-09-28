"use client";

import { X } from "lucide-react";
import AffiliateSettingsTab from "./AffiliateSettingsTab";

interface AffiliateManageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AffiliateManageModal({
  isOpen,
  onClose,
}: AffiliateManageModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#4A4A4A] dark:bg-slate-800 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Affiliate Details & Network Volumes</h2>
            <p className="text-xs text-white/70 font-medium">View products added per affiliate network and inspect linker contributions</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/50">
          <AffiliateSettingsTab />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
