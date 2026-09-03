"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Trash2, X, CheckCircle2 } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info" | "success";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title = "Confirm Action",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Auto-focus cancel button when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => cancelRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const variantConfig = {
    danger: {
      icon: <Trash2 className="w-5 h-5 text-rose-500" />,
      iconBg: "bg-rose-50 dark:bg-rose-950/50 border-rose-100 dark:border-rose-800/60",
      confirmBtn: "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500/30 text-white",
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      iconBg: "bg-amber-50 dark:bg-amber-950/50 border-amber-100 dark:border-amber-800/60",
      confirmBtn: "bg-amber-500 hover:bg-amber-600 focus:ring-amber-400/30 text-white",
    },
    info: {
      icon: <AlertTriangle className="w-5 h-5 text-indigo-500" />,
      iconBg: "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-100 dark:border-indigo-800/60",
      confirmBtn: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500/30 text-white",
    },
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      iconBg: "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60",
      confirmBtn: "bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-500/30 text-white shadow-sm",
    },
  }[variant];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-md overflow-hidden animate-scaleIn">
        {/* Close X */}
        <button
          onClick={onCancel}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Body */}
        <div className="px-6 pt-6 pb-5 flex gap-4">
          {/* Icon */}
          <div
            className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${variantConfig.iconBg}`}
          >
            {variantConfig.icon}
          </div>

          {/* Text */}
          <div className="flex-1 pt-0.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-100 dark:bg-slate-800 mx-6" />

        {/* Actions */}
        <div className="px-6 py-4 flex items-center justify-end gap-2.5">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition focus:outline-none focus:ring-2 focus:ring-slate-400/30 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition focus:outline-none focus:ring-2 cursor-pointer ${variantConfig.confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
