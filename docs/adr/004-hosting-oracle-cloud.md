# ADR-004: Hosting — Oracle Cloud Always Free + Cloudflare Tunnel

**Status:** Accepted
**Date:** 2026-09-29
**Deciders:** Phase 0 design review

## Context

User needs free hosting on the internet. The app requires:
- Always-on (no cold starts; streaming SSE sessions can't tolerate spin-down)
- Persistent disk (SQLite database file must survive restarts)
- HTTPS (required for PWA install and microphone access)
- Private (single-user, not publicly discoverable)

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

**Oracle Cloud Always Free** (ARM VM) with **Cloudflare Tunnel** for HTTPS.

### Resources (free forever)
- **Compute:** 2 OCPUs, 12 GB RAM (Ampere A1)
- **Storage:** 200 GB block storage
- **Network:** 10 TB/month egress (Oracle is uniquely generous here)

### HTTPS via Cloudflare Tunnel
- Install `cloudflared` on the VM
- Create a tunnel pointing `yourdomain.example.com` → `localhost:3000`
- Cloudflare provides TLS termination, DDoS protection, and hides the VM's IP
- Free Cloudflare plan is sufficient

### Alternative (documented in DEPLOYMENT.md)
Home PC + Tailscale for private mesh VPN access. Simpler setup but:
- PC must be on 24/7
- Limited to devices on the Tailscale network
- No public URL (can't share if needed)

## Consequences

- ✅ Truly free, always-on, persistent storage
- ✅ Full control (SSH, Docker, any software)
- ✅ Free HTTPS via Cloudflare Tunnel
- ✅ 2 OCPU + 12 GB RAM is generous for a single-user Node.js + SQLite app
- ⚠️ Oracle Cloud signup may hit "out of capacity" in some regions
- ⚠️ Initial VM setup is more involved than PaaS (documented in DEPLOYMENT.md)
- ⚠️ User must manage OS updates and security patches (documented in RUNBOOK.md)
