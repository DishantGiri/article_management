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

export interface BackupStatus {
  isConfigured: boolean;
  userEmail?: string;
  folderName: string;
  rcloneInstalled: boolean;
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

  return {
    isConfigured,
    rcloneInstalled: rcloneExists,
    folderName: "ArticleManagement_Backups",
    recentBackups,
  };
}
