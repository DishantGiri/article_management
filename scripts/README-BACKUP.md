# Database Backup (Hourly & Daily) & Revert/Restore Guide

Automated MySQL/MariaDB database backups to Google Drive via `rclone` with support for:
- **Hourly Backups** during working hours (9:00 AM – 9:00 PM).
- **Daily Backups** at 12:00 AM (midnight).
- Complete export of all tables, schema, rows, values, triggers, routines, and events.
- **One-Click Revert/Restore** directly from Google Drive or local storage with automated safety snapshots.

---

## 1. Configure Directly from Super Admin Settings (Recommended!)

You no longer need to use the terminal to connect Google Drive!

1. In Google Cloud Console, under **Authorized redirect URIs**, add your callback URL:
   - For local development: `http://localhost:3022/api/backup/google/callback`
   - For production server: `https://dailyworkreport.com/api/backup/google/callback`
2. Log into the system as a **Super Admin**.
3. Navigate to **Settings** (`/settings`).
4. Click on the **Google Drive & Backups** tab.
5. Click **"Connect Google Drive"** to sign in with your Google account.
6. Once connected, you can:
   - View connection status.
   - Run **Daily** or **Hourly** backups with one click.
   - View recent snapshots from both Google Drive and local storage.
   - Click **"Revert to This"** on any snapshot to safely roll back the database with an automatic pre-restore safety snapshot!

---

## 2. Quick CLI Commands

| Action | Command | Description |
| :--- | :--- | :--- |
| **Daily Backup** | `pnpm backup:daily` | Creates full database dump in `daily/` & uploads to Google Drive |
| **Hourly Backup** | `pnpm backup:hourly` | Creates database dump in `hourly/` & uploads to Google Drive |
| **Interactive Restore** | `pnpm restore` | Shows menu of available backups from Google Drive & local storage |
| **Restore Latest** | `pnpm restore:latest` | Instantly reverts database to the most recent backup |
| **List Backups** | `bash ./scripts/restore-from-backup.sh --list` | Lists all available hourly and daily backups |

---

## 3. Server Setup (One-time: `rclone` on VPS)

On your Ubuntu/Debian server (`root@lycoris`):

```bash
# 1. Install rclone
sudo apt update && sudo apt install -y rclone

# 2. Configure Google Drive connection
rclone config
```

In `rclone config`:
1. Type **`n`** (New remote).
2. Name it: **`gdrive`**.
3. Storage type: Select **`Google Drive`** (option `drive`).
4. Press **Enter** to leave `client_id` and `client_secret` blank.
5. Scope: Type **`1`** (Full access).
6. Press **Enter** for `root_folder_id` and `service_account_file`.
7. `Edit advanced config?`: **`n`**.
8. `Use auto config?`:
   - On headless server without desktop: Type **`n`**, run `rclone authorize "drive"` on your local machine, and paste the token back.
9. Confirm (**`y`**) and quit (**`q`**).

Verify connection:
```bash
rclone lsd gdrive:
```

---

## 3. Automated Cron Jobs (Hourly 9 AM – 9 PM & Daily 12 AM)

Open your crontab editor:
```bash
crontab -e
```

Add these two lines:
```cron
# 1. Hourly Database Backup during working hours (9:00 AM to 9:00 PM every hour)
0 9-21 * * * /bin/bash /var/www/fishtail-sites/article_management/scripts/backup-to-gdrive.sh --hourly > /dev/null 2>&1

# 2. Daily Database Backup at 12:00 AM midnight
0 0 * * * /bin/bash /var/www/fishtail-sites/article_management/scripts/backup-to-gdrive.sh --daily > /dev/null 2>&1
```

*(Note: If your project path is different, replace `/var/www/fishtail-sites/article_management` with your actual path).*

---

## 4. How the Backups are Stored on Google Drive

On Google Drive inside `ArticleManagement_Backups`:
- **`hourly/`**:
  - Contains `hourly_<dbname>_YYYY-MM-DD_HH-MM-SS.sql.gz`
  - Retention: Keeps the last **7 days** on Google Drive, **2 days** locally.
- **`daily/`**:
  - Contains `daily_<dbname>_YYYY-MM-DD_HH-MM-SS.sql.gz`
  - Retention: Keeps the last **30 days** on Google Drive, **14 days** locally.

### Data Completeness:
Every backup is dumped using:
`--single-transaction --quick --routines --triggers --events --hex-blob --max-allowed-packet=512M`
This guarantees 100% of all values, tables, character sets, routines, and triggers are backed up without locking your database during live use.

---

## 5. Reverting / Restoring from Backup

### Revert to the Most Recent Backup Immediately:
```bash
pnpm restore:latest
```

### Choose Any Backup to Revert (Interactive Menu):
```bash
pnpm restore
```
1. You will see a list of all hourly and daily backups (both on Google Drive and local storage).
2. Enter the number of the backup you wish to revert to.
3. If the file is only on Google Drive, it will automatically download it.
4. **Pre-Restore Safety Snapshot**: Before touching your live database, the script automatically takes a safety snapshot of the live database (`safety_snapshot_before_restore_<timestamp>.sql.gz`).
5. Your database is restored, and `prisma generate` is run to ensure everything is synchronized.
