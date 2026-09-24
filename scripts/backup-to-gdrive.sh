#!/usr/bin/env bash

# ==============================================================================
# Database Backup to Google Drive (Hourly & Daily)
# Project: Article Management System
# ==============================================================================

set -euo pipefail

# 1. Paths & Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"

# Frequency: "hourly" or "daily" (default: daily)
BACKUP_TYPE="daily"
for arg in "$@"; do
  case "$arg" in
    --hourly|hourly) BACKUP_TYPE="hourly" ;;
    --daily|daily) BACKUP_TYPE="daily" ;;
  esac
done

BACKUP_DIR="${PROJECT_DIR}/backups/${BACKUP_TYPE}"
LOG_DIR="${PROJECT_DIR}/logs"
mkdir -p "${BACKUP_DIR}" "${LOG_DIR}"

LOG_FILE="${LOG_DIR}/backup_${BACKUP_TYPE}.log"
exec > >(tee -a "${LOG_FILE}") 2>&1

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
DATE_DAY=$(date +"%Y-%m-%d")

# 2. Rclone & Remote Configuration
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive}"
RCLONE_BASE_FOLDER="${RCLONE_BASE_FOLDER:-ArticleManagement_Backups}"
TARGET_REMOTE_FOLDER="${RCLONE_BASE_FOLDER}/${BACKUP_TYPE}"

# Retention settings:
# - Hourly: 2 days locally, 7 days on Google Drive
# - Daily:  14 days locally, 30 days on Google Drive
if [ "${BACKUP_TYPE}" = "hourly" ]; then
  LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-2}"
  REMOTE_RETENTION_DAYS="${REMOTE_RETENTION_DAYS:-7}"
else
  LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-14}"
  REMOTE_RETENTION_DAYS="${REMOTE_RETENTION_DAYS:-30}"
fi

echo "======================================================================"
echo "[$(date +"%Y-%m-%d %T")] Starting ${BACKUP_TYPE^^} Database Backup..."
echo "======================================================================"

# 3. Load DB credentials from .env
if [ ! -f "${ENV_FILE}" ]; then
  echo "[-] ERROR: .env file not found at ${ENV_FILE}" >&2
  exit 1
fi

DB_HOST=$(grep -E '^DATABASE_HOST=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
DB_PORT=$(grep -E '^DATABASE_PORT=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
DB_USER=$(grep -E '^DATABASE_USER=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
DB_PASS=$(grep -E '^DATABASE_PASSWORD=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
DB_NAME=$(grep -E '^DATABASE_NAME=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"

if [ -z "${DB_NAME}" ] || [ -z "${DB_USER}" ]; then
  echo "[-] ERROR: DATABASE_NAME or DATABASE_USER is missing in .env" >&2
  exit 1
fi

# Load Google Drive OAuth credentials if defined in .env
GDRIVE_CLIENT_ID=$(grep -E '^GDRIVE_CLIENT_ID=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true)
GDRIVE_CLIENT_SECRET=$(grep -E '^GDRIVE_CLIENT_SECRET=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true)
if [ -n "${GDRIVE_CLIENT_ID:-}" ]; then
  export RCLONE_CONFIG_GDRIVE_CLIENT_ID="${GDRIVE_CLIENT_ID}"
fi
if [ -n "${GDRIVE_CLIENT_SECRET:-}" ]; then
  export RCLONE_CONFIG_GDRIVE_CLIENT_SECRET="${GDRIVE_CLIENT_SECRET}"
fi

# 4. Perform Database Dump with all data and values
DUMP_CMD="mysqldump"
if ! command -v "${DUMP_CMD}" &>/dev/null; then
  if command -v mariadb-dump &>/dev/null; then
    DUMP_CMD="mariadb-dump"
  else
    echo "[-] ERROR: Neither mysqldump nor mariadb-dump was found in PATH." >&2
    exit 1
  fi
fi

BACKUP_FILENAME="${BACKUP_TYPE}_${DB_NAME}_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

echo "[*] Database: ${DB_NAME} on ${DB_HOST}:${DB_PORT} (user: ${DB_USER})"
echo "[*] Destination: ${BACKUP_PATH}"
echo "[*] Exporting all data, schemas, routines, triggers & events..."

MYSQL_PWD="${DB_PASS}" "${DUMP_CMD}" \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --hex-blob \
  --max-allowed-packet=512M \
  "${DB_NAME}" | gzip -9 > "${BACKUP_PATH}"

# Validate file
if [ ! -s "${BACKUP_PATH}" ]; then
  echo "[-] ERROR: Database dump produced an empty file or failed!" >&2
  rm -f "${BACKUP_PATH}"
  exit 1
fi

FILE_SIZE=$(du -h "${BACKUP_PATH}" | cut -f1)
echo "[+] Dump successful: ${BACKUP_FILENAME} (${FILE_SIZE})"

# 5. Upload to Google Drive via rclone
RCLONE_CONF_OPT=""
if [ -f "${PROJECT_DIR}/backups/.rclone.conf" ]; then
  RCLONE_CONF_OPT="--config ${PROJECT_DIR}/backups/.rclone.conf"
elif [ -f "${HOME:-/root}/.config/rclone/rclone.conf" ]; then
  RCLONE_CONF_OPT="--config ${HOME:-/root}/.config/rclone/rclone.conf"
fi

if command -v rclone &>/dev/null; then
  if rclone ${RCLONE_CONF_OPT} listremotes 2>/dev/null | grep -q "^${RCLONE_REMOTE}:"; then
    echo "[*] Uploading to Google Drive: ${RCLONE_REMOTE}:${TARGET_REMOTE_FOLDER}..."
    rclone ${RCLONE_CONF_OPT} copy "${BACKUP_PATH}" "${RCLONE_REMOTE}:${TARGET_REMOTE_FOLDER}/" --progress

    echo "[+] Uploaded to Google Drive successfully!"

    # Prune old backups on Google Drive
    echo "[*] Cleaning up Google Drive (${BACKUP_TYPE}) backups older than ${REMOTE_RETENTION_DAYS} days..."
    rclone ${RCLONE_CONF_OPT} delete "${RCLONE_REMOTE}:${TARGET_REMOTE_FOLDER}" --min-age "${REMOTE_RETENTION_DAYS}d" || true
  else
    echo "[!] WARNING: rclone remote '${RCLONE_REMOTE}' not configured in 'rclone listremotes'."
    echo "[!] Please connect Google Drive in Settings (Super Admin) or run 'rclone config'."
    echo "[!] Local backup kept at: ${BACKUP_PATH}"
  fi
else
  echo "[!] WARNING: 'rclone' is not installed."
  echo "[!] Install it with: sudo apt install -y rclone"
  echo "[!] Local backup kept at: ${BACKUP_PATH}"
fi

# 6. Local Cleanup (Prune old local backups)
echo "[*] Cleaning up local (${BACKUP_TYPE}) backups older than ${LOCAL_RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "${BACKUP_TYPE}_${DB_NAME}_*.sql.gz" -mtime +"${LOCAL_RETENTION_DAYS}" -exec rm -f {} +

echo "======================================================================"
echo "[$(date +"%Y-%m-%d %T")] ${BACKUP_TYPE^^} backup completed: ${BACKUP_FILENAME}"
echo "======================================================================"
