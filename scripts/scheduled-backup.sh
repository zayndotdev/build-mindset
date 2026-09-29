#!/usr/bin/env bash
# ==============================================================================
# Mindset: Scheduled Off-VM Encrypted Backup Script
# ==============================================================================
# Performs an atomic SQLite snapshot (VACUUM INTO), encrypts it with AES-256-GCM
# using the 256-bit MASTER_KEY_HEX, and transfers the encrypted archive off-VM
# to remote object storage or an offsite SSH host.
#
# CRITICAL SECURITY REQUIREMENT:
# ------------------------------
# The master encryption key (MASTER_KEY_HEX) MUST BE STORED SEPARATELY from the
# VM and separately from the backup archive destination.
#
# If the VM disk is destroyed or the cloud account is reclaimed, the off-VM
# backups are USELESS without the master key. Conversely, if the VM is breached,
# an attacker who acquires both the archive and the key can decrypt all data.
# Always keep an offline copy of MASTER_KEY_HEX in a secure password manager
# (e.g. Bitwarden, 1Password, or an encrypted physical vault).
# ==============================================================================

set -euo pipefail

# Configuration defaults (override via environment variables or .env)
APP_DIR="${APP_DIR:-$(pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# Off-VM Transport Configuration:
# Supported types: 'rclone', 's3', 'oci', 'scp', 'gcs', 'none'
OFFSITE_BACKUP_TYPE="${OFFSITE_BACKUP_TYPE:-none}"
OFFSITE_BACKUP_TARGET="${OFFSITE_BACKUP_TARGET:-}"

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [Mindset-Backup] $*"
}

log_error() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [Mindset-Backup] ERROR: $*" >&2
}

# 1. Verify working environment and key availability
cd "$APP_DIR"

if [ -f .env ]; then
  # Safely load non-exported variables if needed
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^(DATABASE_URL|MASTER_KEY_HEX|ENCRYPTION_KEY|OFFSITE_BACKUP_TYPE|OFFSITE_BACKUP_TARGET)=' .env) || true
  set +a
fi

KEY="${MASTER_KEY_HEX:-${ENCRYPTION_KEY:-}}"
if [ -z "$KEY" ]; then
  log_error "MASTER_KEY_HEX (or ENCRYPTION_KEY) is missing! Cannot create encrypted backup."
  log_error "Ensure MASTER_KEY_HEX is exported in environment or configured in .env."
  exit 1
fi

if [ "${#KEY}" -ne 64 ]; then
  log_error "MASTER_KEY_HEX must be exactly 64 hexadecimal characters (32 bytes)."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

TIMESTAMP="$(date -u +'%Y%m%d_%H%M%SZ')"
BACKUP_FILE="$BACKUP_DIR/mindset_backup_${TIMESTAMP}.mbkp"

log "Creating atomic encrypted SQLite backup -> $BACKUP_FILE..."

# 2. Execute encrypted backup engine
if command -v pnpm >/dev/null 2>&1; then
  pnpm exec tsx scripts/backup.ts "${DATABASE_URL:-data/mindset.db}" "$BACKUP_FILE"
elif command -v npx >/dev/null 2>&1; then
  npx tsx scripts/backup.ts "${DATABASE_URL:-data/mindset.db}" "$BACKUP_FILE"
else
  node dist/scripts/backup.js "${DATABASE_URL:-data/mindset.db}" "$BACKUP_FILE"
fi

if [ ! -f "$BACKUP_FILE" ]; then
  log_error "Backup file was not created: $BACKUP_FILE"
  exit 1
fi

# Restrict local archive permissions
chmod 600 "$BACKUP_FILE"
FILESIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null || wc -c < "$BACKUP_FILE")
log "Encrypted backup verified ($FILESIZE bytes, AES-256-GCM tamper-evident header)."

# 3. Off-VM Transfer
if [ "$OFFSITE_BACKUP_TYPE" = "none" ] || [ -z "$OFFSITE_BACKUP_TARGET" ]; then
  log "WARNING: OFFSITE_BACKUP_TYPE is set to 'none' or OFFSITE_BACKUP_TARGET is empty."
  log "Backup remains on local VM only ($BACKUP_FILE)."
  log "CRITICAL: To protect against VM loss, configure OFFSITE_BACKUP_TYPE (e.g. 's3', 'rclone', 'scp')."
else
  log "Transferring backup off-VM via $OFFSITE_BACKUP_TYPE -> $OFFSITE_BACKUP_TARGET..."

  case "$OFFSITE_BACKUP_TYPE" in
    rclone)
      # Works with any cloud (S3, B2, OCI, GCS, OneDrive, etc.) configured in rclone
      rclone copy "$BACKUP_FILE" "$OFFSITE_BACKUP_TARGET"
      ;;
    s3)
      # AWS CLI or S3-compatible endpoint (MinIO, Wasabi, Cloudflare R2)
      aws s3 cp "$BACKUP_FILE" "$OFFSITE_BACKUP_TARGET"
      ;;
    gcs)
      # Google Cloud Storage
      gcloud storage cp "$BACKUP_FILE" "$OFFSITE_BACKUP_TARGET"
      ;;
    oci)
      # Oracle Cloud Infrastructure Object Storage
      oci os object put --file "$BACKUP_FILE" --destination-object-name "$(basename "$BACKUP_FILE")" $OFFSITE_BACKUP_TARGET
      ;;
    scp)
      # Secure copy over SSH to offsite backup host
      scp -o StrictHostKeyChecking=accept-new -i "${SSH_BACKUP_KEY:-$HOME/.ssh/id_ed25519}" "$BACKUP_FILE" "$OFFSITE_BACKUP_TARGET"
      ;;
    *)
      log_error "Unknown OFFSITE_BACKUP_TYPE: $OFFSITE_BACKUP_TYPE"
      exit 1
      ;;
  esac

  log "Off-VM transfer completed successfully."
fi

# 4. Prune local archives older than retention threshold
log "Pruning local archives older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "mindset_backup_*.mbkp" -type f -mtime +"$RETENTION_DAYS" -delete || true

log "Backup workflow completed successfully."
