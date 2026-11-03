"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Key,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  Save,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Coins,
  Users,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";

interface PasswordStatus {
  isSet: boolean;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export default function CommissionPasswordSettings() {
  const [status, setStatus] = useState<PasswordStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Form fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Confirm delete modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/commission-password");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load commission password status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword.trim()) {
      toast.error("Please enter a new password");
      return;
    }

    if (newPassword.trim().length < 4) {
      toast.error("Password must be at least 4 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/settings/commission-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set",
          password: newPassword.trim(),
          enabled: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      toast.success(data.message || "Commission password saved!");
      setNewPassword("");
      setConfirmPassword("");
      // Clear current tab unlocked flag so the user tests with new password
      sessionStorage.removeItem("commission_access_unlocked");
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (newEnabled: boolean) => {
    try {
      setToggling(true);
      const res = await fetch("/api/settings/commission-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          enabled: newEnabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle password protection");
      }

      toast.success(data.message || `Password protection ${newEnabled ? "enabled" : "disabled"}`);
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setToggling(false);
    }
  };

  const handleRemovePassword = async () => {
    try {
      setDeleting(true);
      const res = await fetch("/api/settings/commission-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove password");
      }

      toast.success("Commission password removed");
      setShowDeleteConfirm(false);
      sessionStorage.removeItem("commission_access_unlocked");
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setDeleting(false);
    }
  };

  const handleLockSessionNow = () => {
    sessionStorage.removeItem("commission_access_unlocked");
    toast.success("Session locked! The next visit to User Commissions or Commission Settings will require entering the password.");
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-[#CBCBCB]/70 dark:border-slate-800 p-8 flex flex-col items-center justify-center min-h-[300px]">
        <RefreshCw className="w-8 h-8 text-[#6D8196] animate-spin mb-3" />
        <p className="text-sm font-semibold text-[#737373] dark:text-slate-400">
          Loading commission password security settings...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── HEADER CARD ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-[#CBCBCB]/70 dark:border-slate-800 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6D8196] to-[#4A5D70] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-[#4A4A4A] dark:text-slate-100">
                  Commissions Access Password
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Super Admin Only
                </span>
              </div>
              <p className="text-xs text-[#737373] dark:text-slate-400 font-medium mt-1 max-w-2xl leading-relaxed">
                Protect sensitive commission and earnings data. Setting a password locks both the{" "}
                <span className="font-bold text-[#4A4A4A] dark:text-slate-200">User Commissions</span> and{" "}
                <span className="font-bold text-[#4A4A4A] dark:text-slate-200">Commission Settings</span> tabs behind a secure password verification screen.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2.5 rounded-xl border border-[#CBCBCB] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#4A4A4A] dark:text-slate-300 text-xs font-bold transition cursor-pointer"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ─── STATUS BAR ────────────────────────────────────────── */}
        <div className="mt-6 pt-5 border-t border-[#CBCBCB]/40 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Metric */}
          <div className="p-4 rounded-2xl bg-[#FAF9F5] dark:bg-slate-800/60 border border-[#CBCBCB]/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#737373] dark:text-slate-400">Protection Status</span>
              {status?.isSet ? (
                status.enabled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <ShieldCheck className="w-3 h-3" /> Locked & Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <ShieldAlert className="w-3 h-3" /> Temporarily Paused
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <Unlock className="w-3 h-3" /> Not Configured
                </span>
              )}
            </div>
            <p className="text-xs text-[#4A4A4A] dark:text-slate-200 font-semibold mt-2">
              {status?.isSet
                ? status.enabled
                  ? "Both commission tabs require password verification"
                  : "Password is set, but verification is currently paused"
                : "Tabs are currently open to all authorized roles"}
            </p>
          </div>

          {/* Protected Tabs */}
          <div className="p-4 rounded-2xl bg-[#FAF9F5] dark:bg-slate-800/60 border border-[#CBCBCB]/60 dark:border-slate-700/60">
            <span className="text-xs font-bold text-[#737373] dark:text-slate-400 block mb-2">Protected Sections</span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-700 text-[#4A4A4A] dark:text-slate-200 shadow-2xs">
                <Users className="w-3 h-3 text-[#6D8196]" /> User Commissions
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-[#CBCBCB]/60 dark:border-slate-700 text-[#4A4A4A] dark:text-slate-200 shadow-2xs">
                <Coins className="w-3 h-3 text-purple-600" /> Commission Settings
              </span>
            </div>
          </div>

          {/* Last Modified */}
          <div className="p-4 rounded-2xl bg-[#FAF9F5] dark:bg-slate-800/60 border border-[#CBCBCB]/60 dark:border-slate-700/60">
            <span className="text-xs font-bold text-[#737373] dark:text-slate-400 block mb-1">Last Configured</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#4A4A4A] dark:text-slate-200 mt-1">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                {status?.updatedAt
                  ? new Date(status.updatedAt).toLocaleString()
                  : "Never set"}
              </span>
            </div>
            {status?.updatedBy && (
              <p className="text-[11px] text-[#737373] dark:text-slate-400 mt-1">
                By: {status.updatedBy}
              </p>
            )}
          </div>
        </div>

        {/* Toggle Switch (if password is set) */}
        {status?.isSet && (
          <div className="mt-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-[#CBCBCB]/50 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  status.enabled
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                {status.enabled ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-xs font-bold text-[#4A4A4A] dark:text-slate-200">
                  Enforce Password Requirement
                </p>
                <p className="text-[11px] text-[#737373] dark:text-slate-400">
                  When enabled, visitors must enter the password to view User Commissions and Commission Settings.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => handleToggle(!status.enabled)}
                disabled={toggling}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  status.enabled
                    ? "bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/60 dark:hover:bg-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                {toggling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{status.enabled ? "Pause Protection" : "Enable Protection"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── FORM: SET OR CHANGE PASSWORD ────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-[#CBCBCB]/70 dark:border-slate-800 p-6 sm:p-7 shadow-xs space-y-6">
        <div>
          <h3 className="text-base font-bold text-[#4A4A4A] dark:text-slate-100 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#6D8196]" />
            <span>{status?.isSet ? "Change Commission Password" : "Create Commission Password"}</span>
          </h3>
          <p className="text-xs text-[#737373] dark:text-slate-400 font-medium mt-1">
            {status?.isSet
              ? "Enter a new password below to replace the existing commission password."
              : "Choose a secure password. Anyone trying to access User Commissions or Commission Settings will need this password."}
          </p>
        </div>

        <form onSubmit={handleSavePassword} className="space-y-4 max-w-xl">
          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-[#4A4A4A] dark:text-slate-200 uppercase tracking-wider mb-2">
              New Commission Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter at least 4 characters"
                minLength={4}
                required
                className="w-full px-4 py-2.5 pr-11 bg-white dark:bg-slate-800 border border-[#CBCBCB] dark:border-slate-700 rounded-xl text-sm font-semibold text-[#4A4A4A] dark:text-slate-100 focus:outline-none focus:border-[#6D8196] focus:ring-2 focus:ring-[#6D8196]/20 transition shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold text-[#4A4A4A] dark:text-slate-200 uppercase tracking-wider mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                minLength={4}
                required
                className="w-full px-4 py-2.5 pr-11 bg-white dark:bg-slate-800 border border-[#CBCBCB] dark:border-slate-700 rounded-xl text-sm font-semibold text-[#4A4A4A] dark:text-slate-100 focus:outline-none focus:border-[#6D8196] focus:ring-2 focus:ring-[#6D8196]/20 transition shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                title={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#6D8196] hover:bg-[#5A6D81] text-white text-xs sm:text-sm font-bold shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? "Saving..." : status?.isSet ? "Update Password" : "Save & Activate Password"}</span>
            </button>

            {status?.isSet && (
              <button
                type="button"
                onClick={handleLockSessionNow}
                className="px-4 py-2.5 rounded-xl border border-[#CBCBCB] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-[#4A4A4A] dark:text-slate-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Clears unlock state from this browser tab"
              >
                <Lock className="w-3.5 h-3.5 text-[#6D8196]" />
                <span>Test Lock / Lock Current Tab</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ─── DANGER ZONE: REMOVE PASSWORD ────────────────────────── */}
      {status?.isSet && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/50 p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Remove Password Protection</span>
              </h3>
              <p className="text-xs text-[#737373] dark:text-slate-400 mt-1 max-w-xl">
                Removing the password will allow all authorized team roles to access User Commissions and Commission Settings without a password prompt.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Password</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Remove Commission Password"
        message="Are you sure you want to remove the commission password? Once removed, the User Commissions and Commission Settings pages will no longer be locked behind a password."
        confirmLabel={deleting ? "Removing..." : "Yes, Remove Password"}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleRemovePassword}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
