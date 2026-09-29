# Operations Runbook — Mindset

> Daily operational procedures, diagnostics, failure recovery, key rotation, and disaster restoration for Mindset.

---

## 1. Quick Diagnostics Cheat Sheet

### Service Status & Logs
```bash
# Check if the service is active and running
sudo systemctl status mindset

# Follow live structured logs
sudo journalctl -u mindset -f -o cat

# Check memory and CPU usage
sudo systemctl status mindset | grep -E "CPU|Memory"

# Check port 3000 listener
ss -tulpn | grep 3000
```

### Health Endpoints
```bash
# Check service liveness and uptime
curl http://127.0.0.1:3000/healthz

# Check database connectivity and SQLite readiness
curl http://127.0.0.1:3000/readyz
```

---

## 2. Common Failure Scenarios & Troubleshooting

### Scenario 1: AI Provider 429 Quota Exhaustion / Circuit Breaker OPEN
- **Symptoms**: SSE stream responds with fallback message, or UI displays *"Provider temporarily resting due to rate limits"*.
- **Root Cause**: Free-tier RPM/RPD limit reached on the active provider.
- **Diagnostic**:
  ```bash
  # Check circuit breaker logs
  sudo journalctl -u mindset -n 100 | grep -i "circuit breaker"
  ```
- **Remediation**:
  1. The system handles this automatically via the AI Router fallback chain (Gemini -> Groq -> Mistral -> Cohere).
  2. If all providers are in backoff, wait for the rest window (default 60 seconds) to expire.
  3. In **Settings > Providers UI**, reorder priority or provide a secondary API key with fresh quota.

### Scenario 2: Forgotten Passphrase / Locked Out
- **Symptoms**: User cannot remember passphrase; 5 failed attempts trigger rate-limit lockout.
- **Root Cause**: Forgotten passphrase for single-user system.
- **Remediation**:
  1. SSH into the host VM.
  2. Stop the running service:
     ```bash
     sudo systemctl stop mindset
     ```
  3. Reset the credentials record using the offline admin script:
     ```bash
     cd /opt/mindset
     pnpm tsx scripts/reset-passphrase.ts
     ```
  4. Restart the service:
     ```bash
     sudo systemctl start mindset
     ```
  5. Open the web interface. The app will prompt for the **First-Run Passphrase Setup** to set a new passphrase.

### Scenario 3: Database Lock or High Write Contention
- **Symptoms**: Log messages displaying `SQLITE_BUSY: database is locked`.
- **Root Cause**: Concurrent long-running transaction or uncommitted write lock.
- **Diagnostic**:
  ```bash
  ls -lh /opt/mindset/data/
  # Check if mindset.db-wal is unusually large (>50MB)
  ```
- **Remediation**:
  1. Fastify uses `node:sqlite` in WAL mode with connection pooling.
  2. Force a WAL checkpoint:
     ```bash
     cd /opt/mindset
     pnpm tsx scripts/checkpoint-db.ts
     ```
  3. If persistent, restart the service to cleanly release any file locks.

---

## 3. Disaster Recovery & Restoring Backups

If the database becomes corrupted, accidentally truncated, or if an entire new VM is provisioned after total host failure:

> [!IMPORTANT]
> **Master Key Requirement**: If the original VM was lost or re-provisioned, retrieve `MASTER_KEY_HEX` from your offline password manager (1Password, Bitwarden). It was never stored on the lost VM disk.

1. **Retrieve the latest backup from off-VM storage** (if restoring onto a new or rebuilt VM):
   ```bash
   # From S3:
   aws s3 cp s3://my-mindset-backup-bucket/daily/latest.mbkp /opt/mindset/backups/
   # Or via rclone:
   rclone copy remote:mindset-backups/latest.mbkp /opt/mindset/backups/
   ```

2. **Locate the latest valid backup**:
   ```bash
   ls -lt /opt/mindset/backups/*.mbkp | head -n 5
   ```
3. **Stop the active service**:
   ```bash
   sudo systemctl stop mindset
   ```
4. **Execute the encrypted restore CLI**:
   ```bash
   cd /opt/mindset
   export MASTER_KEY_HEX="<your-master-key-from-password-manager>"
   pnpm tsx scripts/restore.ts /opt/mindset/backups/latest.mbkp /opt/mindset/data/mindset.db
   ```
   *The restore engine verifies the `MBKP` magic bytes, decrypts via AES-256-GCM using `MASTER_KEY_HEX`, validates the 16-byte authentication tag, and replaces the database file.*
5. **Restart the service**:
   ```bash
   sudo systemctl start mindset
   ```
6. **Verify health**:
   ```bash
   curl http://127.0.0.1:3000/readyz
   # Expected: {"status":"ok","db":"connected"}
   ```

---

## 4. Upgrading the Application

To deploy bug fixes, model updates, or new curriculum topics from the repository:

```bash
cd /opt/mindset

# 1. Fetch latest changes
git fetch origin
git checkout overnight
git pull origin overnight

# 2. Install any updated dependencies
pnpm install --frozen-lockfile

# 3. Build production bundle
pnpm build

# 4. Run database migrations and seed new topics
pnpm seed

# 5. Restart service
sudo systemctl restart mindset

# 6. Verify health
curl http://127.0.0.1:3000/healthz
```

---

## 5. Routine Maintenance Tasks

| Frequency | Task | Command |
|---|---|---|
| **Daily** | Verify backup creation | `ls -lt /opt/mindset/backups/*.mbkp \| head -n 1` |
| **Weekly** | Check disk space on VM | `df -h /` |
| **Monthly** | Test restore of latest backup | `pnpm tsx scripts/restore.ts <latest.mbkp> /tmp/test-restore.db` |
| **Quarterly** | Check provider deprecation notices | Review `docs/AI_PROVIDERS.md` and provider changelogs |
