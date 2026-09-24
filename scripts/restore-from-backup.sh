#!/usr/bin/env bash

# ==============================================================================
# Revert / Restore Database from Backup (Hourly or Daily from Google Drive/Local)
# Project: Article Management System
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"

BACKUP_DIR="${PROJECT_DIR}/backups"
LOG_DIR="${PROJECT_DIR}/logs"
mkdir -p "${BACKUP_DIR}" "${LOG_DIR}"

LOG_FILE="${LOG_DIR}/restore.log"
exec > >(tee -a "${LOG_FILE}") 2>&1

RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive}"
RCLONE_BASE_FOLDER="${RCLONE_BASE_FOLDER:-ArticleManagement_Backups}"

# Arguments parsing
AUTO_LATEST=false
SPECIFIED_FILE=""
AUTO_CONFIRM=false
ACTION_FLAG=""

for arg in "$@"; do
  case "$arg" in
    --latest) AUTO_LATEST=true ;;
    --yes|-y) AUTO_CONFIRM=true ;;
    --list) ACTION_FLAG="list" ;;
    --file=*) SPECIFIED_FILE="${arg#*=}" ;;
    --file) shift; SPECIFIED_FILE="${1:-}" ;;
  esac
done

# 1. Load DB credentials from .env
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

# Load Google Drive OAuth credentials if defined in .env
GDRIVE_CLIENT_ID=$(grep -E '^GDRIVE_CLIENT_ID=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true)
GDRIVE_CLIENT_SECRET=$(grep -E '^GDRIVE_CLIENT_SECRET=' "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true)
if [ -n "${GDRIVE_CLIENT_ID:-}" ]; then
  export RCLONE_CONFIG_GDRIVE_CLIENT_ID="${GDRIVE_CLIENT_ID}"
fi
if [ -n "${GDRIVE_CLIENT_SECRET:-}" ]; then
  export RCLONE_CONFIG_GDRIVE_CLIENT_SECRET="${GDRIVE_CLIENT_SECRET}"
fi

echo "======================================================================"
echo "[$(date +"%Y-%m-%d %T")] Database Restore / Revert Utility"
echo "======================================================================"

# 2. Gather All Available Backups (Local + Google Drive)
# Format stored: "folder/filename" -> e.g. "hourly/hourly_article_mg_2026-09-24_13-00-00.sql.gz"
declare -A BACKUP_SOURCES
ALL_BACKUP_PATHS=()

add_backup() {
  local rel_path="$1"
  local source="$2"
  if [ -n "$rel_path" ]; then
    if [ -z "${BACKUP_SOURCES["$rel_path"]:-}" ]; then
      BACKUP_SOURCES["$rel_path"]="$source"
      ALL_BACKUP_PATHS+=("$rel_path")
    else
      BACKUP_SOURCES["$rel_path"]="local+gdrive"
    fi
  fi
}

# Scan local backups in backups/hourly, backups/daily, and root backups/
if [ -d "${BACKUP_DIR}" ]; then
  while IFS= read -r f; do
    if [ -n "$f" ]; then
      rel="${f#"${BACKUP_DIR}/"}"
      add_backup "$rel" "local"
    fi
  done < <(find "${BACKUP_DIR}" -type f \( -name "*.sql.gz" -o -name "*.tar.gz" \) | sort -r)
fi

# Scan Google Drive via rclone
RCLONE_CONF_OPT=""
if [ -f "${PROJECT_DIR}/backups/.rclone.conf" ]; then
  RCLONE_CONF_OPT="--config ${PROJECT_DIR}/backups/.rclone.conf"
elif [ -f "${HOME:-/root}/.config/rclone/rclone.conf" ]; then
  RCLONE_CONF_OPT="--config ${HOME:-/root}/.config/rclone/rclone.conf"
fi

HAS_RCLONE=false
if command -v rclone &>/dev/null && rclone ${RCLONE_CONF_OPT} listremotes 2>/dev/null | grep -q "^${RCLONE_REMOTE}:"; then
  HAS_RCLONE=true
  echo "[*] Checking Google Drive for backups (${RCLONE_REMOTE}:${RCLONE_BASE_FOLDER})..."
  while IFS= read -r f; do
    if [ -n "$f" ]; then
      add_backup "$f" "gdrive"
    fi
  done < <(rclone ${RCLONE_CONF_OPT} lsf "${RCLONE_REMOTE}:${RCLONE_BASE_FOLDER}" --recursive --files-only 2>/dev/null | grep -E '\.(sql\.gz|tar\.gz)$' | sort -r || true)
fi

# Sort and deduplicate (latest first)
IFS=$'\n' SORTED_BACKUPS=($(sort -r -u <<<"${ALL_BACKUP_PATHS[*]}"))
unset IFS

if [ "${ACTION_FLAG}" = "list" ]; then
  echo "Available Backups:"
  if [ ${#SORTED_BACKUPS[@]} -eq 0 ]; then
    echo "  (No backups found)"
  else
    for i in "${!SORTED_BACKUPS[@]}"; do
      b="${SORTED_BACKUPS[$i]}"
      echo "  [$((i + 1))] $b  [${BACKUP_SOURCES[$b]}]"
    done
  fi
  exit 0
fi

if [ ${#SORTED_BACKUPS[@]} -eq 0 ]; then
  echo "[-] ERROR: No backups found locally or on Google Drive." >&2
  exit 1
fi

# 3. Select Backup to Restore
CHOSEN_REL_PATH=""

if [ -n "${SPECIFIED_FILE}" ]; then
  CHOSEN_REL_PATH="${SPECIFIED_FILE}"
elif [ "${AUTO_LATEST}" = true ]; then
  CHOSEN_REL_PATH="${SORTED_BACKUPS[0]}"
  echo "[+] Auto-selecting latest backup: ${CHOSEN_REL_PATH}"
else
  echo "Available Backups to Restore:"
  for i in "${!SORTED_BACKUPS[@]}"; do
    b="${SORTED_BACKUPS[$i]}"
    loc="${BACKUP_SOURCES[$b]}"
    echo "  [$((i + 1))] $b  (${loc})"
  done
  echo ""
  read -rp "Enter choice [1-${#SORTED_BACKUPS[@]}] (default: 1 for latest): " CHOICE
  CHOICE="${CHOICE:-1}"
  idx=$((CHOICE - 1))
  if [ "$idx" -lt 0 ] || [ "$idx" -ge "${#SORTED_BACKUPS[@]}" ]; then
    echo "[-] ERROR: Invalid selection: $CHOICE" >&2
    exit 1
  fi
  CHOSEN_REL_PATH="${SORTED_BACKUPS[$idx]}"
fi

echo "[*] Selected Backup: ${CHOSEN_REL_PATH}"

# 4. Download from Google Drive if not local
LOCAL_BACKUP_FILE="${BACKUP_DIR}/${CHOSEN_REL_PATH}"
if [ ! -f "${LOCAL_BACKUP_FILE}" ]; then
  if [ "${HAS_RCLONE}" = true ]; then
    echo "[*] Downloading ${CHOSEN_REL_PATH} from Google Drive..."
    mkdir -p "$(dirname "${LOCAL_BACKUP_FILE}")"
    rclone ${RCLONE_CONF_OPT} copy "${RCLONE_REMOTE}:${RCLONE_BASE_FOLDER}/${CHOSEN_REL_PATH}" "$(dirname "${LOCAL_BACKUP_FILE}")/" --progress
  else
    echo "[-] ERROR: File is not stored locally and rclone is not available to download it." >&2
    exit 1
  fi
fi

# 5. Safety Warning & Confirmation
echo ""
echo "======================================================================"
echo "[!] WARNING: You are about to revert database '${DB_NAME}' using:"
echo "    ${CHOSEN_REL_PATH}"
echo "[!] ALL current tables and rows in '${DB_NAME}' will be overwritten!"
echo "======================================================================"

if [ "${AUTO_CONFIRM}" != true ]; then
  read -rp "Are you sure you want to proceed? [y/N]: " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "[-] Restore cancelled by user."
    exit 0
  fi
fi

# 6. Pre-Restore Safety Snapshot of current Database
SAFETY_SNAPSHOT="${BACKUP_DIR}/safety_snapshot_before_restore_$(date +"%Y-%m-%d_%H-%M-%S").sql.gz"
echo "[*] Creating safety snapshot of live database before restore..."
if command -v mysqldump &>/dev/null; then
  MYSQL_PWD="${DB_PASS}" mysqldump \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --user="${DB_USER}" \
    --single-transaction \
    --quick \
    "${DB_NAME}" | gzip -9 > "${SAFETY_SNAPSHOT}" || true
  echo "[+] Safety snapshot saved to: $(basename "${SAFETY_SNAPSHOT}")"
fi

# 7. Restore Database
MYSQL_CMD="mysql"
if ! command -v "${MYSQL_CMD}" &>/dev/null; then
  if command -v mariadb &>/dev/null; then
    MYSQL_CMD="mariadb"
  else
    echo "[-] ERROR: mysql or mariadb CLI client not found in PATH." >&2
    exit 1
  fi
fi

echo "[*] Restoring database '${DB_NAME}'..."

if [[ "${LOCAL_BACKUP_FILE}" == *.tar.gz ]]; then
  # If a bundled tar.gz archive, extract SQL stream directly
  tar -xOf "${LOCAL_BACKUP_FILE}" "database.sql.gz" 2>/dev/null | gunzip | \
    MYSQL_PWD="${DB_PASS}" "${MYSQL_CMD}" \
      --host="${DB_HOST}" \
      --port="${DB_PORT}" \
      --user="${DB_USER}" \
      "${DB_NAME}"
elif [[ "${LOCAL_BACKUP_FILE}" == *.sql.gz ]]; then
  # Direct gzipped SQL dump
  gunzip -c "${LOCAL_BACKUP_FILE}" | \
    MYSQL_PWD="${DB_PASS}" "${MYSQL_CMD}" \
      --host="${DB_HOST}" \
      --port="${DB_PORT}" \
      --user="${DB_USER}" \
      "${DB_NAME}"
fi

echo "[+] Database '${DB_NAME}' successfully restored from: $(basename "${LOCAL_BACKUP_FILE}")"

# 8. Synchronize Prisma client types
if command -v npx &>/dev/null; then
  echo "[*] Running prisma generate..."
  (cd "${PROJECT_DIR}" && npx prisma generate) || true
fi

echo "======================================================================"
echo "[$(date +"%Y-%m-%d %T")] RESTORE COMPLETED SUCCESSFULLY!"
echo "======================================================================"
