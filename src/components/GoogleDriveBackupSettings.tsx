/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Cloud,
  Database,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Play,
  RotateCcw,
  Clock,
  HardDrive,
  ShieldCheck,
  AlertTriangle,
  FolderOpen,
  Key,
  X,
  Search,
  Copy,
  Check,
  Activity,
  Calendar,
  Sparkles,
} from "lucide-react";
import { toast } from "react-hot-toast";

interface BackupItem {
  name: string;
  path: string;
  type: "hourly" | "daily" | "other";
  size: string;
  date: string;
  source: "local" | "gdrive" | "both";
}

interface ScheduleInfo {
  type: "hourly" | "daily";
  name: string;
  expression: string;
  humanSchedule: string;
  nextRun: string;
  lastRun?: {
    timestamp: string;
    filename: string;
    size: string;
    gdriveSynced: boolean;
    success: boolean;
  } | null;
}

interface BackupStatus {
  isConfigured: boolean;
  userEmail?: string;
  folderName: string;
  rcloneInstalled: boolean;
  cronInstalled: boolean;
  serverTime: string;
  serverTimezone: string;
  schedules: {
    hourly: ScheduleInfo;
    daily: ScheduleInfo;
  };
  recentBackups: BackupItem[];
}

export default function GoogleDriveBackupSettings() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningBackup, setRunningBackup] = useState<"daily" | "hourly" | null>(null);
  const [testing, setTesting] = useState(false);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);
  const [confirmRestoreItem, setConfirmRestoreItem] = useState<BackupItem | null>(null);
  const [activatingCron, setActivatingCron] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "hourly" | "daily">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "both" | "gdrive" | "local">("all");
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  // Live timer tick for real-time countdown
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Manual Token / Paste state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/backup/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        toast.error("Failed to load backup status");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error communicating with backup service");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Check if URL has ?success= or ?error= from OAuth callback
    const params = new URLSearchParams(window.location.search);
    const successMsg = params.get("success");
    const errorMsg = params.get("error");
    if (successMsg) {
      toast.success(successMsg);
      window.history.replaceState({}, "", window.location.pathname + "?tab=backup");
    }
    if (errorMsg) {
      toast.error(errorMsg);
      window.history.replaceState({}, "", window.location.pathname + "?tab=backup");
    }
  }, [fetchStatus]);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/backup/test", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Google Drive connection test passed!");
        fetchStatus();
      } else {
        toast.error(data.message || "Connection test failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Google Drive? Backups will only remain on local storage.")) {
      return;
    }
    try {
      const res = await fetch("/api/backup/disconnect", { method: "POST" });
      if (res.ok) {
        toast.success("Google Drive disconnected");
        fetchStatus();
      } else {
        toast.error("Failed to disconnect");
      }
    } catch {
      toast.error("Error disconnecting Google Drive");
    }
  };

  const handleRunBackup = async (type: "daily" | "hourly") => {
    setRunningBackup(type);
    try {
      const res = await fetch("/api/backup/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        fetchStatus();
      } else {
        toast.error(data.error || `Failed to run ${type} backup`);
      }
    } catch (e: any) {
      toast.error(e.message || "Backup execution failed");
    } finally {
      setRunningBackup(null);
    }
  };

  const handleActivateCron = async () => {
    setActivatingCron(true);
    try {
      const res = await fetch("/api/backup/cron", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Automated schedules enabled!");
        fetchStatus();
      } else {
        toast.error(data.error || "Failed to configure cron");
      }
    } catch (e: any) {
      toast.error(e.message || "Cron setup failed");
    } finally {
      setActivatingCron(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!confirmRestoreItem) return;
    setRestoringFile(confirmRestoreItem.path);
    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: confirmRestoreItem.path }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        setConfirmRestoreItem(null);
        fetchStatus();
      } else {
        toast.error(data.error || "Failed to restore database");
      }
    } catch (e: any) {
      toast.error(e.message || "Restore failed");
    } finally {
      setRestoringFile(null);
    }
  };

  const handleSaveManualToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    setSavingManual(true);
    try {
      const res = await fetch("/api/backup/disconnect", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: manualToken.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Token configured successfully!");
        setShowManualModal(false);
        setManualToken("");
        fetchStatus();
      } else {
        toast.error(data.error || "Failed to save token");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to save manual token");
    } finally {
      setSavingManual(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(text);
    toast.success("Snapshot filename copied to clipboard");
    setTimeout(() => setCopiedFile(null), 2500);
  };

  // Helper: Live Countdown Formatter
  const getCountdown = useCallback((targetIso?: string) => {
    if (!targetIso) return { text: "Calculating...", isPast: false };
    const target = new Date(targetIso).getTime();
    const diffMs = target - currentTime.getTime();

    if (diffMs <= 0) {
      return { text: "Due now", isPast: true };
    }

    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (hours > 0) {
      return { text: `${hours}h ${minutes}m ${seconds}s`, isPast: false };
    }
    if (minutes > 0) {
      return { text: `${minutes}m ${seconds}s`, isPast: false };
    }
    return { text: `${seconds}s`, isPast: false };
  }, [currentTime]);

  // Helper: Format target schedule time
  const formatTargetTime = (isoStr?: string) => {
    if (!isoStr) return "--";
    const d = new Date(isoStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
    if (isToday) return `Today, ${timeStr}`;
    if (isTomorrow) return `Tomorrow, ${timeStr}`;
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${timeStr}`;
  };

  // Helper: Relative time
  const formatRelativeTime = (isoStr?: string) => {
    if (!isoStr) return "Never";
    const d = new Date(isoStr);
    const diffMs = currentTime.getTime() - d.getTime();
    if (diffMs < 0) return "Just now";
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay}d ago`;
  };

  // Filtered Backups List
  const filteredBackups = useMemo(() => {
    if (!status?.recentBackups) return [];
    return status.recentBackups.filter((b) => {
      // Type filter
      if (typeFilter !== "all" && b.type !== typeFilter) return false;
      // Source filter
      if (sourceFilter !== "all") {
        if (sourceFilter === "both" && b.source !== "both") return false;
        if (sourceFilter === "gdrive" && b.source !== "gdrive" && b.source !== "both") return false;
        if (sourceFilter === "local" && b.source !== "local" && b.source !== "both") return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return b.name.toLowerCase().includes(q) || b.date.toLowerCase().includes(q);
      }
      return true;
    });
  }, [status?.recentBackups, typeFilter, sourceFilter, searchQuery]);

  const hourlyCountdown = getCountdown(status?.schedules?.hourly?.nextRun);
  const dailyCountdown = getCountdown(status?.schedules?.daily?.nextRun);

  return (
    <div className="space-y-8">
      {/* 1. Header & Status Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Google Drive & Database Backups
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-700">
                  Super Admin
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Automated database snapshots, hourly & daily syncing to Google Drive, and one-click rollback.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {status?.cronInstalled ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Auto Backups Active
              </span>
            ) : (
              <button
                onClick={handleActivateCron}
                disabled={activatingCron}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                {activatingCron ? "Activating..." : "Enable Auto Cron"}
              </button>
            )}

            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="Refresh Status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Connection State Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          {/* Drive Status */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Google Drive Status
              </div>
              <div className="flex items-center gap-2">
                {status?.isConfigured ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-amber-500" />
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Not Connected</span>
                  </>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Destination Folder:{" "}
                <code className="px-1.5 py-0.5 bg-slate-200/60 dark:bg-slate-700/60 rounded font-mono text-[11px]">
                  {status?.folderName || "ArticleManagement_Backups"}
                </code>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center gap-2">
              {!status?.isConfigured ? (
                <a
                  href="/api/backup/google/auth"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  Connect Drive
                </a>
              ) : (
                <>
                  <button
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition"
                  >
                    <ShieldCheck className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} />
                    {testing ? "Testing..." : "Test Connection"}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-800 transition"
                  >
                    Disconnect
                  </button>
                </>
              )}
              <button
                onClick={() => setShowManualModal(true)}
                className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs transition"
                title="Manual Token Setup"
              >
                <Key className="w-3.5 h-3.5" />
                Token
              </button>
            </div>
          </div>

          {/* Active Schedules */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Active Schedules
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800">
                  Automated
                </span>
              </div>
              <div className="space-y-1.5 mt-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-purple-500" />
                    <span className="font-semibold">Hourly:</span>
                    <span className="text-slate-500">9:00 AM – 9:00 PM</span>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                    {hourlyCountdown.text}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <Database className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="font-semibold">Daily:</span>
                    <span className="text-slate-500">12:00 AM (Midnight)</span>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    {dailyCountdown.text}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Timezone: {status?.serverTimezone || "Asia/Kathmandu"}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Activity className="w-3 h-3" /> Cron Active
              </span>
            </div>
          </div>

          {/* Available Backups */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Available Backups
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {status?.recentBackups?.length || 0}{" "}
                <span className="text-sm font-normal text-slate-500">Snapshots</span>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                {status?.recentBackups?.filter((b) => b.type === "hourly").length || 0} Hourly ·{" "}
                {status?.recentBackups?.filter((b) => b.type === "daily").length || 0} Daily ·{" "}
                {status?.recentBackups?.filter((b) => b.type === "other").length || 0} Manual
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Cloud Sync + Local Rollback</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-medium">Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Automated Next Backup Live Cards & Instant Triggers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hourly Card */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-purple-100 dark:border-purple-900/40 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/5 rounded-bl-full pointer-events-none" />
          
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/60 dark:border-purple-800/50">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  Hourly Snapshot
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300">
                    Hourly
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Every hour between 9:00 AM – 9:00 PM
                </p>
              </div>
            </div>
          </div>

          {/* Next Backup Live Countdown Box */}
          <div className="p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-900/40 mb-4">
            <div className="flex items-center justify-between text-xs text-purple-900 dark:text-purple-300 font-semibold mb-1">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-purple-500 animate-spin" style={{ animationDuration: "6s" }} />
                Next Backup In
              </span>
              <span className="text-purple-600 dark:text-purple-400 font-normal">
                {formatTargetTime(status?.schedules?.hourly?.nextRun)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="font-mono text-2xl font-extrabold text-purple-700 dark:text-purple-300">
                {hourlyCountdown.text}
              </div>
              <span className="text-xs text-purple-500/80 font-medium">auto schedule</span>
            </div>
          </div>

          {/* Last Run Status & Retention */}
          <div className="space-y-2 mb-5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Last Snapshot:</span>
              <span className="font-medium">
                {status?.schedules?.hourly?.lastRun?.timestamp ? (
                  <>
                    {formatRelativeTime(status.schedules.hourly.lastRun.timestamp)} (
                    {status.schedules.hourly.lastRun.size})
                  </>
                ) : (
                  "No hourly snapshot taken yet"
                )}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Retention Policy:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                2 days local · 7 days on Google Drive
              </span>
            </div>
          </div>

          <button
            onClick={() => handleRunBackup("hourly")}
            disabled={runningBackup !== null}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition shadow-sm hover:shadow-purple-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${runningBackup === "hourly" ? "animate-spin" : ""}`} />
            {runningBackup === "hourly" ? "Taking Hourly Snapshot..." : "Run Hourly Backup Now"}
          </button>
        </div>

        {/* Daily Card */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/5 rounded-bl-full pointer-events-none" />

          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/50">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  Daily Snapshot
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                    Daily
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Every night at 12:00 AM (Midnight)
                </p>
              </div>
            </div>
          </div>

          {/* Next Backup Live Countdown Box */}
          <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-900/40 mb-4">
            <div className="flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-300 font-semibold mb-1">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                Next Backup In
              </span>
              <span className="text-indigo-600 dark:text-indigo-400 font-normal">
                {formatTargetTime(status?.schedules?.daily?.nextRun)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="font-mono text-2xl font-extrabold text-indigo-700 dark:text-indigo-300">
                {dailyCountdown.text}
              </div>
              <span className="text-xs text-indigo-500/80 font-medium">auto schedule</span>
            </div>
          </div>

          {/* Last Run Status & Retention */}
          <div className="space-y-2 mb-5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Last Snapshot:</span>
              <span className="font-medium">
                {status?.schedules?.daily?.lastRun?.timestamp ? (
                  <>
                    {formatRelativeTime(status.schedules.daily.lastRun.timestamp)} (
                    {status.schedules.daily.lastRun.size})
                  </>
                ) : (
                  "No daily snapshot taken yet"
                )}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Retention Policy:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                14 days local · 30 days on Google Drive
              </span>
            </div>
          </div>

          <button
            onClick={() => handleRunBackup("daily")}
            disabled={runningBackup !== null}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition shadow-sm hover:shadow-indigo-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${runningBackup === "daily" ? "animate-spin" : ""}`} />
            {runningBackup === "daily" ? "Taking Daily Snapshot..." : "Run Daily Backup Now"}
          </button>
        </div>
      </div>

      {/* 3. Available Snapshots & One-Click Restore Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-emerald-500" />
              Available Snapshots & One-Click Restore
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select any snapshot to revert the database. An automatic safety snapshot will be taken before reverting.
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search snapshot..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Type Filter Buttons */}
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
              <button
                onClick={() => setTypeFilter("all")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  typeFilter === "all"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                All ({status?.recentBackups?.length || 0})
              </button>
              <button
                onClick={() => setTypeFilter("hourly")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  typeFilter === "hourly"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Hourly ({status?.recentBackups?.filter((b) => b.type === "hourly").length || 0})
              </button>
              <button
                onClick={() => setTypeFilter("daily")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  typeFilter === "daily"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Daily ({status?.recentBackups?.filter((b) => b.type === "daily").length || 0})
              </button>
            </div>
          </div>
        </div>

        {filteredBackups.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Snapshot Name</th>
                  <th className="px-4 py-3">Frequency</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBackups.map((b) => (
                  <tr key={b.path} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-xs">{b.name}</span>
                        <button
                          onClick={() => copyToClipboard(b.name)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                          title="Copy file name"
                        >
                          {copiedFile === b.name ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {b.type === "hourly" ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          Hourly
                        </span>
                      ) : b.type === "daily" ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          Daily
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        {b.source === "both" ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <Cloud className="w-3.5 h-3.5" /> Drive + Local
                          </span>
                        ) : b.source === "gdrive" ? (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
                            <Cloud className="w-3.5 h-3.5" /> Google Drive
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-500 font-medium">
                            <HardDrive className="w-3.5 h-3.5" /> Local Disk
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {b.size}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div>{new Date(b.date).toLocaleString()}</div>
                      <div className="text-[11px] text-slate-400">{formatRelativeTime(b.date)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setConfirmRestoreItem(b)}
                        disabled={restoringFile !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 font-semibold text-xs transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Revert Database
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800">
            <Database className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              {searchQuery ? "No matching snapshots found." : "No backups available yet."}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Click &quot;Run Hourly Backup Now&quot; or &quot;Run Daily Backup Now&quot; above to create your first snapshot.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Restore */}
      {confirmRestoreItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-xl border border-amber-200 dark:border-amber-800/50">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-base">Revert Database?</h4>
                <p className="text-xs text-slate-500">Live database rollback</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p>
                You are about to restore and overwrite your active MySQL database with snapshot:
              </p>
              <p className="font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 break-all">
                {confirmRestoreItem.name}
              </p>
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold pt-1">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>An automatic pre-restore safety snapshot will be created before applying.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRestoreItem(null)}
                disabled={restoringFile !== null}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={restoringFile !== null}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm transition-colors shadow-md shadow-amber-500/20 disabled:opacity-50"
              >
                <RotateCcw className={`w-4 h-4 ${restoringFile ? "animate-spin" : ""}`} />
                {restoringFile ? "Restoring..." : "Yes, Revert Database"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Token Setup Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-500" />
                Manual Token Configuration
              </h4>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Paste the Google Drive OAuth JSON token string below (from <code className="text-purple-600">rclone authorize &quot;drive&quot;</code> or Service Account):
            </p>

            <form onSubmit={handleSaveManualToken} className="space-y-4">
              <textarea
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder='{"access_token":"ya29...","token_type":"Bearer","refresh_token":"1//...","expiry":"..."}'
                rows={5}
                className="w-full font-mono text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingManual}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm disabled:opacity-50"
                >
                  {savingManual ? "Saving..." : "Save & Configure"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
