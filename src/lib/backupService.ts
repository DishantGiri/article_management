import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const PROJECT_DIR = process.cwd();
const BACKUP_DIR = path.join(PROJECT_DIR, "backups");
const RCLONE_CONFIG_PATH = path.join(BACKUP_DIR, ".rclone.conf");
const USER_RCLONE_DIR = path.join(process.env.HOME || "/root", ".config", "rclone");
const USER_RCLONE_CONF = path.join(USER_RCLONE_DIR, "rclone.conf");

export interface ScheduleInfo {
  type: "hourly" | "daily";
  name: string;
  expression: string;
  humanSchedule: string;
  nextRun: string; // ISO string
  lastRun?: {
    timestamp: string;
    filename: string;
    size: string;
    gdriveSynced: boolean;
    success: boolean;
  } | null;
}

export interface BackupStatus {
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
  recentBackups: {
    name: string;
    path: string;
    type: "hourly" | "daily" | "other";
    size: string;
    date: string;
    source: "local" | "gdrive" | "both";
  }[];
}

/**
 * Calculates the next hourly snapshot run date/time.
 * Cron expression: 0 9-21 * * * (At minute 0, every hour from 9:00 AM to 9:00 PM)
 */
export function getNextHourlyRun(now: Date = new Date()): Date {
  const d = new Date(now.getTime());
  const currentHour = d.getHours();
  const currentMin = d.getMinutes();
  const currentSec = d.getSeconds();
  const currentMs = d.getMilliseconds();

  // If current time is strictly on the hour (e.g. 10:00:00.000), next run is 1 hour later
  const pastTheHour = currentMin > 0 || currentSec > 0 || currentMs > 0;
  const startHour = pastTheHour ? currentHour + 1 : currentHour;

  for (let h = startHour; h <= 21; h++) {
    if (h >= 9) {
      d.setHours(h, 0, 0, 0);
      return d;
    }
  }

  // If past 21:00 or before tomorrow's 9:00 AM window
  const tomorrow = new Date(now.getTime());
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow;
}

/**
 * Calculates the next daily snapshot run date/time.
 * Cron expression: 0 0 * * * (At 00:00 / 12:00 AM Midnight every day)
 */
export function getNextDailyRun(now: Date = new Date()): Date {
  const next = new Date(now.getTime());
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

/**
 * Reads the last run status JSON or falls back to filesystem stats
 */
export function getLastRunInfo(type: "hourly" | "daily"): {
  timestamp: string;
  filename: string;
  size: string;
  gdriveSynced: boolean;
  success: boolean;
} | null {
  const logDir = path.join(PROJECT_DIR, "logs");
  const statusFile = path.join(logDir, `last_${type}_status.json`);

  if (fs.existsSync(statusFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(statusFile, "utf-8"));
      return {
        timestamp: data.timestamp,
        filename: data.filename,
        size: data.size,
        gdriveSynced: !!data.gdriveSynced,
        success: !!data.success,
      };
    } catch {
      // ignore parse error and fallback
    }
  }

  // Fallback: check most recent file in backups/[type]
  const dir = path.join(BACKUP_DIR, type);
  if (fs.existsSync(dir)) {
    try {
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".sql.gz"))
        .map((f) => {
          const filePath = path.join(dir, f);
          const stat = fs.statSync(filePath);
          return { name: f, time: stat.mtime.getTime(), size: stat.size, date: stat.mtime.toISOString() };
        })
        .sort((a, b) => b.time - a.time);

      if (files.length > 0) {
        const top = files[0];
        const sizeKb = Math.round(top.size / 1024);
        const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
        return {
          timestamp: top.date,
          filename: top.name,
          size: sizeStr,
          gdriveSynced: false,
          success: true,
        };
      }
    } catch {}
  }

  return null;
}

/**
 * Checks if crontab contains the backup script
 */
export async function checkCronInstalled(): Promise<boolean> {
  try {
    const { stdout } = await execAsync("crontab -l");
    return stdout.includes("backup-to-gdrive.sh");
  } catch {
    return false;
  }
}

/**
 * Ensures system crontab has the automated backup entries configured
 */
export async function ensureCronInstalled(): Promise<{ success: boolean; message: string }> {
  try {
    let existingCron = "";
    try {
      const { stdout } = await execAsync("crontab -l");
      existingCron = stdout;
    } catch {
      existingCron = "";
    }

    // Clean existing backup-to-gdrive lines to prevent duplicates
    const lines = existingCron
      .split("\n")
      .filter(
        (line) =>
          !line.includes("backup-to-gdrive.sh") &&
          !line.includes("Article Management Automated Backups")
      );

    const scriptPath = path.join(PROJECT_DIR, "scripts", "backup-to-gdrive.sh");
    const logDir = path.join(PROJECT_DIR, "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const newCron = [
      ...lines,
      "# Article Management Automated Backups",
      "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      `0 9-21 * * * /usr/bin/bash "${scriptPath}" --hourly >> "${path.join(logDir, "backup_hourly_cron.log")}" 2>&1`,
      `0 0 * * * /usr/bin/bash "${scriptPath}" --daily >> "${path.join(logDir, "backup_daily_cron.log")}" 2>&1`,
      "",
    ].join("\n");

    await execAsync(`cat << 'CRON_EOF' | crontab -\n${newCron}\nCRON_EOF`);
    return { success: true, message: "Automated cron schedules installed successfully" };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to configure crontab" };
  }
}

/**
 * Ensures the rclone config file exists and is synced to ~/.config/rclone/rclone.conf
 */
export function getRcloneConfigPath(): string {
  if (fs.existsSync(RCLONE_CONFIG_PATH)) {
    return RCLONE_CONFIG_PATH;
  }
  if (fs.existsSync(USER_RCLONE_CONF)) {
    return USER_RCLONE_CONF;
  }
  return RCLONE_CONFIG_PATH;
}

/**
 * Checks if rclone is installed on the host
 */
export async function isRcloneInstalled(): Promise<boolean> {
  try {
    await execAsync("which rclone");
    return true;
  } catch {
    return false;
  }
}

/**
 * Writes or updates the [gdrive] section in the rclone config file
 */
export function saveGoogleDriveToken(tokenJsonStr: string) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const clientId = process.env.GDRIVE_CLIENT_ID || "";
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET || "";

  const configContent = `[gdrive]
type = drive
client_id = ${clientId}
client_secret = ${clientSecret}
scope = drive
token = ${tokenJsonStr}
`;

  // Write to project backups/.rclone.conf
  fs.writeFileSync(RCLONE_CONFIG_PATH, configContent, { mode: 0o600 });

  // Also write to ~/.config/rclone/rclone.conf for terminal tools
  try {
    if (!fs.existsSync(USER_RCLONE_DIR)) {
      fs.mkdirSync(USER_RCLONE_DIR, { recursive: true });
    }
    fs.writeFileSync(USER_RCLONE_CONF, configContent, { mode: 0o600 });
  } catch (e) {
    console.warn("Could not write to user rclone config:", e);
  }
}

/**
 * Removes the [gdrive] configuration
 */
export function removeGoogleDriveConfig() {
  if (fs.existsSync(RCLONE_CONFIG_PATH)) {
    fs.unlinkSync(RCLONE_CONFIG_PATH);
  }
  if (fs.existsSync(USER_RCLONE_CONF)) {
    try {
      fs.unlinkSync(USER_RCLONE_CONF);
    } catch {}
  }
}

/**
 * Checks Google Drive connection via rclone
 */
export async function testGoogleDriveConnection(): Promise<{ success: boolean; message: string }> {
  const rcloneExists = await isRcloneInstalled();
  if (!rcloneExists) {
    return { success: false, message: "rclone is not installed on this server. Run 'sudo apt install rclone'." };
  }

  const conf = getRcloneConfigPath();
  if (!fs.existsSync(conf)) {
    return { success: false, message: "Google Drive is not configured yet. Click 'Connect Google Drive'." };
  }

  try {
    const { stdout } = await execAsync(`rclone --config "${conf}" lsd gdrive: --max-depth 1`, { timeout: 15000 });
    return { success: true, message: `Connected to Google Drive successfully. Output:\n${stdout.trim() || "(empty root folder)"}` };
  } catch (err: any) {
    return { success: false, message: err.stderr || err.message || "Failed to reach Google Drive." };
  }
}

/**
 * Retrieves the list of available backups (local + Google Drive)
 */
export async function getBackupStatus(): Promise<BackupStatus> {
  const rcloneExists = await isRcloneInstalled();
  const conf = getRcloneConfigPath();
  const isConfigured = fs.existsSync(conf);

  const backupsMap = new Map<string, {
    name: string;
    path: string;
    type: "hourly" | "daily" | "other";
    size: string;
    date: string;
    source: "local" | "gdrive" | "both";
  }>();

  // 1. Scan Local Backups
  if (fs.existsSync(BACKUP_DIR)) {
    const scanDir = (dir: string, type: "hourly" | "daily" | "other") => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith(".sql.gz") || file.endsWith(".tar.gz")) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          const relPath = path.relative(BACKUP_DIR, filePath);
          const sizeKb = Math.round(stat.size / 1024);
          const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

          backupsMap.set(relPath, {
            name: file,
            path: relPath,
            type,
            size: sizeStr,
            date: stat.mtime.toISOString(),
            source: "local",
          });
        }
      }
    };

    scanDir(path.join(BACKUP_DIR, "hourly"), "hourly");
    scanDir(path.join(BACKUP_DIR, "daily"), "daily");
    scanDir(BACKUP_DIR, "other");
  }

  // 2. Scan Google Drive Backups if configured
  if (rcloneExists && isConfigured) {
    try {
      const { stdout } = await execAsync(
        `rclone --config "${conf}" lsf "gdrive:ArticleManagement_Backups" --recursive --format "p,s,t" 2>/dev/null`,
        { timeout: 10000 }
      );

      const lines = stdout.split("\n").filter((l) => l.trim().length > 0);
      for (const line of lines) {
        const parts = line.split(";");
        if (parts.length >= 3) {
          const relPath = parts[0].trim();
          const bytes = parseInt(parts[1].trim(), 10) || 0;
          const dateStr = parts[2].trim();
          const fileName = path.basename(relPath);

          let type: "hourly" | "daily" | "other" = "other";
          if (relPath.startsWith("hourly/")) type = "hourly";
          else if (relPath.startsWith("daily/")) type = "daily";

          const sizeKb = Math.round(bytes / 1024);
          const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

          if (backupsMap.has(relPath)) {
            backupsMap.get(relPath)!.source = "both";
          } else {
            backupsMap.set(relPath, {
              name: fileName,
              path: relPath,
              type,
              size: sizeStr,
              date: dateStr,
              source: "gdrive",
            });
          }
        }
      }
    } catch (e) {
      console.warn("Could not query Google Drive backups via rclone:", e);
    }
  }

  const recentBackups = Array.from(backupsMap.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const cronInstalled = await checkCronInstalled();
  const now = new Date();
  const nextHourly = getNextHourlyRun(now);
  const nextDaily = getNextDailyRun(now);

  const schedules = {
    hourly: {
      type: "hourly" as const,
      name: "Hourly Snapshot",
      expression: "0 9-21 * * *",
      humanSchedule: "Hourly: 9:00 AM – 9:00 PM",
      nextRun: nextHourly.toISOString(),
      lastRun: getLastRunInfo("hourly"),
    },
    daily: {
      type: "daily" as const,
      name: "Daily Snapshot",
      expression: "0 0 * * *",
      humanSchedule: "Daily: 12:00 AM (Midnight)",
      nextRun: nextDaily.toISOString(),
      lastRun: getLastRunInfo("daily"),
    },
  };

  return {
    isConfigured,
    rcloneInstalled: rcloneExists,
    cronInstalled,
    serverTime: now.toISOString(),
    serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kathmandu",
    folderName: "ArticleManagement_Backups",
    schedules,
    recentBackups,
  };
}
