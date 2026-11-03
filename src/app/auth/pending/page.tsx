"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Clock,
  Mail,
  ExternalLink,
  Copy,
  Check,
  LogOut,
  Building2,
  ShieldAlert,
} from "lucide-react";
import { toast } from "react-hot-toast";

export default function PendingApprovalPage() {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);

  const adminEmail = "support@fishtailinfosolutions.com";
  const hrmsUrl = "https://hrms.fishtailinfosolutions.com";

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(adminEmail);
    setCopied(true);
    toast.success("Admin email copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const mailtoSubject = encodeURIComponent(
    `Account Approval Request - ${session?.user?.name || "New Team Member"}`
  );
  const mailtoBody = encodeURIComponent(
    `Hello Admin Team,\n\nI have registered an account on Article Flow with email: ${session?.user?.email || ""}.\nPlease review and approve my account so I can access the system.\n\nThank you,\n${session?.user?.name || "Team Member"}`
  );
  const mailtoUrl = `mailto:${adminEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/20 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/80 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-7 sm:p-8 space-y-6 text-center transition-all duration-300">
        
        {/* Pending Icon */}
        <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200/60 dark:from-amber-950/60 dark:to-amber-900/40 border border-amber-300/60 dark:border-amber-700/60 rounded-2xl flex items-center justify-center shadow-md mx-auto transform transition duration-500 hover:scale-105">
          <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400 animate-pulse" />
        </div>

        {/* Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 mb-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Verification Required</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Pending Approval
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">
            Account requires administrator activation
          </p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent" />

        {/* User Info & Message */}
        <div className="space-y-3.5 text-left">
          {session?.user && (
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Registered Account
              </p>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                {session.user.name}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {session.user.email}
              </p>
            </div>
          )}

          <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed text-center">
            Welcome to Article Flow! Your Google account has been registered. Before you can access articles and product links, an administrator must approve your account and assign your team role.
          </p>

          {/* Fishtail HRMS Note */}
          <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 flex items-start gap-2.5 text-amber-900 dark:text-amber-200 text-xs">
            <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <span className="font-bold">Fishtail HRMS Verification:</span> Please follow up with your Project Lead or HR Administrator to activate your account.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          {/* PRIMARY ACTION: Contact Admin for Approval */}
          <a
            href={mailtoUrl}
            className="w-full py-3 px-4 bg-[#6D8196] hover:bg-[#5A6D81] text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Mail className="w-4 h-4" />
            <span>Contact Admin for Approval</span>
          </a>

          {/* HRMS Portal Link & Copy Email Row */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={hrmsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>Fishtail HRMS</span>
            </a>

            <button
              type="button"
              onClick={handleCopyEmail}
              className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? "Copied" : "Copy Email"}</span>
            </button>
          </div>

          {/* SECONDARY OPTION: Sign Out & Try Another Account */}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="w-full py-2.5 px-4 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl font-semibold text-xs transition duration-200 flex items-center justify-center gap-2 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out &amp; Try Another Account</span>
          </button>
        </div>

      </div>
    </div>
  );
}
