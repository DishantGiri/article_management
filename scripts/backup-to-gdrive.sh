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

DB_HOST=$(grep -E '^DATABASE_HOST=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true)
DB_PORT=$(grep -E '^DATABASE_PORT=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true)
DB_USER=$(grep -E '^DATABASE_USER=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true)
DB_PASS=$(grep -E '^DATABASE_PASSWORD=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true)
DB_NAME=$(grep -E '^DATABASE_NAME=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true)

# If DB_USER or DB_NAME is missing, parse from DATABASE_URL
if [ -z "${DB_USER:-}" ] || [ -z "${DB_NAME:-}" ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true)
  if [ -n "${DATABASE_URL:-}" ]; then
    PROTO_REMOVED="${DATABASE_URL#*://}"
    USER_PASS="${PROTO_REMOVED%%@*}"
    HOST_PORT_DB="${PROTO_REMOVED#*@}"
    
    DB_USER="${DB_USER:-${USER_PASS%%:*}}"
    DB_PASS="${DB_PASS:-${USER_PASS#*:}}"
    
    HOST_PORT="${HOST_PORT_DB%%/*}"
    DB_HOST="${DB_HOST:-${HOST_PORT%%:*}}"
    if [[ "${HOST_PORT}" == *:* ]]; then
      DB_PORT="${DB_PORT:-${HOST_PORT#*:}}"
    fi
    
    DB_REST="${HOST_PORT_DB#*/}"
    DB_NAME="${DB_NAME:-${DB_REST%%\?*}}"
  fi
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"

if [ -z "${DB_NAME:-}" ] || [ -z "${DB_USER:-}" ]; then
  echo "[-] ERROR: DATABASE_NAME or DATABASE_USER is missing in .env and could not be determined from DATABASE_URL" >&2
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
    echo "[-] ERROR: Neither mysqldump nor mariadb-dump was found in PATH. Install with: sudo apt install -y mysql-client" >&2
    exit 1
  fi
fi

BACKUP_FILENAME="${BACKUP_TYPE}_${DB_NAME}_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

echo "[*] Database: ${DB_NAME} on ${DB_HOST}:${DB_PORT} (user: ${DB_USER})"
echo "[*] Destination: ${BACKUP_PATH}"
echo "[*] Exporting data, schemas, triggers..."

# Try comprehensive dump (with routines & events). If privileges fail, retry without routines/events.
DUMP_ERROR_FILE="${LOG_DIR}/mysqldump_err_${TIMESTAMP}.tmp"
if ! MYSQL_PWD="${DB_PASS}" "${DUMP_CMD}" \
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
  "${DB_NAME}" 2>"${DUMP_ERROR_FILE}" | gzip -9 > "${BACKUP_PATH}"; then

  echo "[!] Notice: Comprehensive dump failed (possibly due to MySQL EVENT/PROCESS privileges). Retrying standard dump..."
  if [ -f "${DUMP_ERROR_FILE}" ]; then
    cat "${DUMP_ERROR_FILE}" >&2
    rm -f "${DUMP_ERROR_FILE}"
  fi

  MYSQL_PWD="${DB_PASS}" "${DUMP_CMD}" \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --user="${DB_USER}" \
    --single-transaction \
    --quick \
    --triggers \
    --hex-blob \
    --max-allowed-packet=512M \
    "${DB_NAME}" | gzip -9 > "${BACKUP_PATH}"
else
  rm -f "${DUMP_ERROR_FILE}"
fi

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

if ! command -v rclone &>/dev/null; then
  echo "[-] ERROR: 'rclone' is not installed on this server." >&2
  echo "[-] Install it with: sudo apt install -y rclone" >&2
  echo "[*] Local backup preserved at: ${BACKUP_PATH}"
  exit 1
fi

if ! rclone ${RCLONE_CONF_OPT} listremotes 2>/dev/null | grep -q "^${RCLONE_REMOTE}:"; then
  echo "[-] ERROR: Google Drive is not connected yet (remote '${RCLONE_REMOTE}' not found)." >&2
  echo "[-] Please open Settings -> Backup in the web dashboard and click 'Connect Google Drive'." >&2
  echo "[*] Local backup preserved at: ${BACKUP_PATH}"
  exit 1
fi

echo "[*] Uploading to Google Drive: ${RCLONE_REMOTE}:${TARGET_REMOTE_FOLDER}..."
rclone ${RCLONE_CONF_OPT} copy "${BACKUP_PATH}" "${RCLONE_REMOTE}:${TARGET_REMOTE_FOLDER}/"

echo "[+] Uploaded to Google Drive successfully!"

# Prune old backups on Google Drive
echo "[*] Cleaning up Google Drive (${BACKUP_TYPE}) backups older than ${REMOTE_RETENTION_DAYS} days..."
rclone ${RCLONE_CONF_OPT} delete "${RCLONE_REMOTE}:${TARGET_REMOTE_FOLDER}" --min-age "${REMOTE_RETENTION_DAYS}d" || true

# 6. Local Cleanup (Prune old local backups)
echo "[*] Cleaning up local (${BACKUP_TYPE}) backups older than ${LOCAL_RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "${BACKUP_TYPE}_${DB_NAME}_*.sql.gz" -mtime +"${LOCAL_RETENTION_DAYS}" -exec rm -f {} +

echo "======================================================================"
echo "[$(date +"%Y-%m-%d %T")] ${BACKUP_TYPE^^} backup completed: ${BACKUP_FILENAME}"
echo "======================================================================"
