# Deployment Guide — Oracle Cloud Always Free + Tailscale Serve

> Complete step-by-step deployment guide for hosting Mindset privately on an Oracle Cloud Always Free ARM instance with Tailscale Serve.

---

## 1. Architecture Overview

```
                      [ Private Tailnet ]
+-------------------------------------------------------------+
|                                                             |
|   +-------------------+              +------------------+   |
|   |   Android Phone   |              |  Oracle VM (ARM) |   |
|   |  (Chrome / PWA)   |              |  Ubuntu 24.04    |   |
|   +---------+---------+              +--------+---------+   |
|             |                                 |             |
|             |        Tailscale WireGuard      |             |
|             +================================>+             |
|                  HTTPS (your-node.ts.net)     |             |
|                                         Tailscale Serve     |
|                                               | (TLS term)  |
|                                               v             |
|                                        Fastify (Port 3000)  |
|                                               |             |
|                                        SQLite WAL Storage   |
+-------------------------------------------------------------+
```

- **Private by Design**: The Oracle Cloud VM has **no public ingress ports** open in its security list (port 80/443 remain closed to the public internet).
- **Auto-TLS**: Tailscale Serve terminates HTTPS automatically using Let's Encrypt certificates issued for your Tailscale MagicDNS node name (`*.ts.net`).
- **Cost**: $0.00/month on Oracle Cloud Always Free.

---

## 2. Prerequisites

1. **Oracle Cloud Infrastructure (OCI) Account**:
   - Free tier account created with credit card verification.
   - **Recommendation (D-002 / ADR-004)**: Upgrade account to **Pay As You Go (PAYG)**. Always Free resources remain 100% free under the tier limits ($0 cost), and PAYG eliminates the risk of idle instance termination.
2. **Tailscale Account**:
   - Free personal tier account (supports up to 3 users and 100 devices).
   - MagicDNS enabled in the Tailscale admin console.
3. **Primary Device**:
   - Android phone with Tailscale app installed and logged into the same tailnet.

---

## 3. Step-by-Step Provisioning

### Step 1: Create the Oracle Cloud Compute Instance
1. In the OCI Console, navigate to **Compute > Instances > Create Instance**.
2. **Name**: `mindset-coach-vm`
3. **Image**: Ubuntu 24.04 LTS (or Oracle Linux 9).
4. **Shape**: Ampere VM.Standard.A1.Flex (ARM64):
   - OCPUs: 2
   - Memory: 12 GB
5. **Networking**: Select your default VCN. Under Security List, do **not** add public HTTP/HTTPS ingress rules. (Only port 22 SSH restricted to your current IP, or connect via OCI Cloud Shell / Bastion).
6. **SSH Keys**: Download and save the generated private key.
7. Click **Create** and wait for instance status to turn **Running**.

### Step 2: System Setup & Dependencies
SSH into the instance:
```bash
ssh -i /path/to/ssh-key.key ubuntu@<INSTANCE_PUBLIC_IP>
```

Update system packages and install prerequisites:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw build-essential
```

Install Node.js 24 and pnpm:
```bash
# Install Node.js 24 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node version (must be >= 24.0.0)
node -v

# Install pnpm globally
sudo npm install -g pnpm
```

### Step 3: Install & Configure Tailscale
```bash
# Install official Tailscale package
curl -fsSL https://tailscale.com/install.sh | sh

# Start Tailscale and authenticate to your tailnet
sudo tailscale up --ssh --accept-routes
```
Follow the URL printed to authorize the node in your Tailscale admin console. Enable MagicDNS and note your node name (e.g., `mindset-coach.tailnet123.ts.net`).

### Step 4: Clone & Configure Mindset
```bash
cd /opt
sudo git clone https://github.com/zayndotdev/build-mindset.git mindset
sudo chown -R ubuntu:ubuntu /opt/mindset
cd /opt/mindset

# Checkout the deployment branch
git checkout overnight
```

Create production configuration (`.env`):
```bash
cp .env.example .env
nano .env
```
Fill in the production environment variables:
```env
PORT=3000
HOST=127.0.0.1
NODE_ENV=production
DATABASE_PATH=/opt/mindset/data/mindset.db
LOG_LEVEL=info
ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
CORS_ALLOWED_ORIGINS=https://mindset-coach.tailnet123.ts.net
BACKUP_DIR=/opt/mindset/backups
```

Install dependencies and build production artifacts:
```bash
pnpm install --frozen-lockfile
pnpm build
```

Run database migrations and initial topic seed:
```bash
pnpm seed
```

### Step 5: Configure systemd Service
Create the service unit file:
```bash
sudo nano /etc/systemd/system/mindset.service
```
Add the following content:
```ini
[Unit]
Description=Mindset AI Socratic Coach
After=network.target tailscaled.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/mindset
ExecStart=/usr/bin/pnpm --filter api start
Restart=always
RestartSec=5
EnvironmentFile=/opt/mindset/.env
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Reload systemd and start Mindset:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mindset
sudo systemctl status mindset
```

Verify local health:
```bash
curl http://127.0.0.1:3000/healthz
# Expected: {"status":"ok","uptime":...}
```

### Step 6: Expose via Tailscale Serve (HTTPS)
Expose the local Fastify port 3000 over your private tailnet with automatic TLS:
```bash
sudo tailscale serve --bg https / http://127.0.0.1:3000
```
Verify the serve status:
```bash
sudo tailscale serve status
# Shows: https://mindset-coach.tailnet123.ts.net -> http://127.0.0.1:3000
```

---

## 4. Setting Up Nightly Encrypted Off-VM Backups

To ensure complete disaster recovery against Oracle VM hardware failure, disk corruption, or Always Free account reclamation, Mindset includes an automated off-VM backup runner (`scripts/scheduled-backup.sh`).

> [!CAUTION]
> **CRITICAL MASTER KEY INVARIANT:**
> The master encryption key (`MASTER_KEY_HEX` / `ENCRYPTION_KEY`) **must be stored separately from the VM**.
> - Save `MASTER_KEY_HEX` in an offline password manager (1Password, Bitwarden, KeePassXC).
> - Never store the master key in the same offsite storage bucket as the backup archives.
> - If the VM is lost and the master key only existed on the VM, your off-VM backups are permanently undecryptable!

### Step 1: Configure Off-VM Destination in `.env`
Mindset supports multiple off-VM transports (`rclone`, `s3`, `gcs`, `oci`, `scp`):

```env
# Choose transport: rclone | s3 | gcs | oci | scp | copy
OFFSITE_BACKUP_TYPE=s3
OFFSITE_BACKUP_TARGET=s3://my-mindset-backup-bucket/daily/
RETENTION_DAYS=14
```

### Step 2: Test the Scheduled Backup Script
```bash
cd /opt/mindset
chmod +x scripts/scheduled-backup.sh
./scripts/scheduled-backup.sh
```

### Step 3: Schedule via Crontab or Systemd Timer
Add to root or app user crontab (`crontab -e`):
```cron
# Run daily at 03:00 UTC, piping output to log
0 3 * * * /opt/mindset/scripts/scheduled-backup.sh >> /var/log/mindset-backup.log 2>&1
```

---

## 5. Mobile PWA Installation & Verification

1. On your Android phone, connect to Tailscale.
2. Open Chrome and navigate to: `https://mindset-coach.tailnet123.ts.net`.
3. Complete the one-time **First-Run Passphrase Setup**.
4. Tap the Chrome three-dot menu and select **"Install App"** (or **"Add to Home Screen"**).
5. Open the installed Mindset PWA from your home screen.
6. Navigate to **Settings > Providers** and input your Gemini, Groq, Mistral, or Cohere API keys.
7. Start your first session!
