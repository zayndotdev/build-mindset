# ADR-004: Hosting — Oracle Cloud Always Free + Tailscale Serve

**Status:** Accepted (revised — Tailscale Serve replaces Cloudflare Tunnel)
**Date:** 2026-09-29 (revised)
**Deciders:** Phase 0 design review

## Context

User needs free hosting on the internet. The app requires:
- Always-on (no cold starts; streaming SSE sessions can't tolerate spin-down)
- Persistent disk (SQLite database file must survive restarts)
- HTTPS (required for PWA install and microphone access)
- Accessible from user's phone (not necessarily from arbitrary internet)

## Options Considered

| Platform | Always-On | Persistent Disk | Free | Notes |
|----------|-----------|-----------------|------|-------|
| Render (free) | ❌ spins down 15m | ❌ ephemeral FS | ✅ | Unsuitable |
| Railway | ❌ trial credits | ✅ | ❌ long-term | Credits exhaust |
| Fly.io | ❌ trial only | ✅ volumes | ❌ long-term | No free tier |
| Cloudflare Workers + D1 | ✅ | ✅ (D1) | ✅ | Requires rewrite to edge runtime |
| Oracle Cloud Always Free | ✅ | ✅ 200 GB | ✅ | Full VM, full control |
| Home PC + Tailscale | ✅ (if on) | ✅ | ✅ | Depends on PC uptime |

## Decision

**Oracle Cloud Always Free** (ARM VM) with **Tailscale Serve** for HTTPS.

### Resources (free forever — with caveats, see below)
- **Compute:** 2 OCPUs, 12 GB RAM (Ampere A1)
- **Storage:** 200 GB block storage
- **Network:** 10 TB/month egress (Oracle is uniquely generous here)

### HTTPS via Tailscale Serve

Tailscale Serve provides HTTPS with automatic TLS certificates to devices on
your Tailnet. This is sufficient for our use case: a private, single-user
app accessed only from your own phone and laptop.

```bash
# On the Oracle VM (after installing Tailscale):
tailscale serve https / http://localhost:3000
```

Your app is then accessible at `https://<vm-hostname>.<tailnet-name>.ts.net`
from any device logged into your Tailscale network.

**Access model:** The URL is reachable ONLY from devices on your Tailnet.
It is NOT publicly accessible from the internet, which is fine for a
single-user app. Your phone + laptop are both on the Tailnet.

**No domain required.** Tailscale provides a `.ts.net` subdomain automatically.

### Why NOT Cloudflare Tunnel (changed from v0.1)

The v0.1 design claimed Cloudflare Tunnel URLs are "not publicly
discoverable" — this is **incorrect**. Tunnel URLs are publicly accessible
on the internet; anyone who discovers the URL can reach the app. While we
have auth (passphrase), exposing any surface to the open internet is
unnecessary for a single-user app.

Tailscale Serve is genuinely private — traffic stays on the Tailnet mesh,
never touching the public internet. This is a stronger security posture.

## Oracle Cloud — Important Caveats

### ⚠️ Credit Card Required at Signup

Oracle Cloud requires a **valid credit card** for identity verification,
even for the Always Free tier. You will NOT be charged for Always Free
resources, but a small temporary authorization hold may appear.

### ⚠️ Idle Instance Reclaim Policy

Oracle may reclaim Always Free instances that are **idle for 7 consecutive
days**. An instance is "idle" if ALL of the following are true over the
7-day period:

- CPU utilization (95th percentile) < 20%
- Network utilization < 20%
- Memory utilization < 20% (for A1 shapes)

**Mitigation strategies:**
1. **Cron heartbeat:** A simple cron job (e.g., `curl localhost:3000/healthz`
   every 5 minutes) generates enough CPU/network activity to stay above
   thresholds.
2. **SQLite WAL checkpoints:** Periodic background tasks (backup, stats
   rollup) keep the process active.
3. **Monitoring:** Set up a free uptime checker (e.g., Uptime Robot free
   tier, which won't reach the app on Tailnet — use a Tailscale-accessible
   monitor or the cron on the VM itself).

### ⚠️ Regional Capacity

"Out of host capacity" errors are common when provisioning ARM instances,
especially in popular regions. Retry strategies:

1. Try during off-peak hours (weekends, early morning)
2. Try different availability domains within the same region
3. Try a different home region (can't change after account creation)
4. Use the OCI CLI with a provisioning script that retries automatically

## Consequences

- ✅ Truly free, always-on, persistent storage
- ✅ Full control (SSH, Docker, any software)
- ✅ Free HTTPS via Tailscale (automatic TLS, `.ts.net` subdomain)
- ✅ Genuinely private — not exposed to the public internet
- ✅ No domain purchase needed
- ✅ 2 OCPU + 12 GB RAM is generous for a single-user Node.js + SQLite app
- ⚠️ Credit card required for Oracle Cloud signup
- ⚠️ Idle instances may be reclaimed (mitigated by cron heartbeat)
- ⚠️ ARM capacity may be limited in some regions
- ⚠️ User must manage OS updates and security patches
- ⚠️ Phone must have Tailscale installed and logged in
