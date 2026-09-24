/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
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
  HelpCircle,
  Key,
  ExternalLink,
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

interface BackupStatus {
  isConfigured: boolean;
  folderName: string;
  rcloneInstalled: boolean;
  recentBackups: BackupItem[];
}

export default function GoogleDriveBackupSettings() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningBackup, setRunningBackup] = useState<"daily" | "hourly" | null>(null);
  const [testing, setTesting] = useState(false);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);
  const [confirmRestoreItem, setConfirmRestoreItem] = useState<BackupItem | null>(null);

  // Manual Token / Paste state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [savingManual, setSavingManual] = useState(false);

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
      // Clean query params from URL
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

  return (
    <div className="space-y-8">
      {/* 1. Header & Status Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/40">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Google Drive & Database Backups
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-700">
                  Super Admin
                </span>
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Automated database snapshots, hourly & daily syncing to Google Drive, and one-click rollback.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="Refresh Status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Connection State Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Google Drive Status
            </div>
            <div className="flex items-center gap-2">
              {status?.isConfigured ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Connected</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-amber-500" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Not Connected</span>
                </>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Destination Folder: <code className="px-1.5 py-0.5 bg-slate-200/60 dark:bg-slate-700/60 rounded">{status?.folderName || "ArticleManagement_Backups"}</code>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Active Schedules
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                <Clock className="w-3.5 h-3.5 text-purple-500" />
                <span className="font-semibold">Hourly:</span> 9:00 AM – 9:00 PM
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                <Database className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-semibold">Daily:</span> 12:00 AM (Midnight)
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Available Backups
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {status?.recentBackups?.length || 0} Snapshots
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {status?.recentBackups?.filter((b) => b.type === "hourly").length || 0} Hourly ·{" "}
              {status?.recentBackups?.filter((b) => b.type === "daily").length || 0} Daily
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-6">
          {!status?.isConfigured ? (
            <a
              href="/api/backup/google/auth"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-md shadow-blue-500/20 transition-all text-sm"
            >
              <Cloud className="w-4 h-4" />
              Connect Google Drive
            </a>
          ) : (
            <>
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 font-medium transition-colors text-sm"
              >
                <ShieldCheck className={`w-4 h-4 ${testing ? "animate-spin" : ""}`} />
                {testing ? "Testing..." : "Test Connection"}
              </button>
              <button
                onClick={handleDisconnect}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 font-medium transition-colors text-sm"
              >
                <XCircle className="w-4 h-4" />
                Disconnect Drive
              </button>
            </>
          )}

          <button
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition-colors text-sm ml-auto"
          >
            <Key className="w-4 h-4 text-slate-500" />
            Manual Token Setup
          </button>
        </div>
      </div>

      {/* 2. Manual Backup Trigger Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          <Play className="w-5 h-5 text-indigo-500" />
          Trigger Instant Backup
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Trigger an immediate database dump and upload to Google Drive without waiting for the automated cron schedule.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-1">
                <Clock className="w-4 h-4 text-purple-500" />
                Hourly Snapshot
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Saves to <code className="text-xs bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">hourly/</code>. Retained for 7 days on Google Drive.
              </p>
            </div>
            <button
              onClick={() => handleRunBackup("hourly")}
              disabled={runningBackup !== null}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${runningBackup === "hourly" ? "animate-spin" : ""}`} />
              {runningBackup === "hourly" ? "Exporting Hourly..." : "Run Hourly Backup"}
            </button>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-1">
                <Database className="w-4 h-4 text-indigo-500" />
                Daily Snapshot
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Saves to <code className="text-xs bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">daily/</code>. Retained for 30 days on Google Drive.
              </p>
            </div>
            <button
              onClick={() => handleRunBackup("daily")}
              disabled={runningBackup !== null}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${runningBackup === "daily" ? "animate-spin" : ""}`} />
              {runningBackup === "daily" ? "Exporting Daily..." : "Run Daily Backup"}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Available Backups & Restore Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-emerald-500" />
              Available Snapshots & One-Click Restore
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select any snapshot to revert the database. An automatic safety snapshot will be taken before reverting.
            </p>
          </div>
        </div>

        {status?.recentBackups && status.recentBackups.length > 0 ? (
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
                {status.recentBackups.map((b) => (
                  <tr key={b.path} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                      {b.name}
                    </td>
                    <td className="px-4 py-3">
                      {b.type === "hourly" ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          Hourly
                        </span>
                      ) : b.type === "daily" ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          Daily
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        {b.source === "both" ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <Cloud className="w-3.5 h-3.5" /> Drive + Local
                          </span>
                        ) : b.source === "gdrive" ? (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <Cloud className="w-3.5 h-3.5" /> Google Drive
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-500">
                            <HardDrive className="w-3.5 h-3.5" /> Local Disk
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{b.size}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(b.date).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setConfirmRestoreItem(b)}
                        disabled={restoringFile !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 font-medium text-xs transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Revert to This
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
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">No backups available yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Click &quot;Run Daily Backup&quot; or &quot;Run Hourly Backup&quot; above to create your first snapshot.
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
                You are about to overwrite your active database with snapshot:
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
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm transition-colors shadow-md shadow-amber-500/20 disabled:opacity-50"
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
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              If your server does not have web access or you generated an OAuth token or Service Account token separately, paste the JSON token string below:
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
