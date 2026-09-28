import type { ProviderId } from '@mindset/shared';

export class QuotaTracker {
  private restingMap = new Map<ProviderId, number>();

  public recordRateLimit(providerId: ProviderId, retryAfterMs: number = 60000): void {
    const duration = retryAfterMs > 0 ? retryAfterMs : 60000;
    const until = Date.now() + duration;
    this.restingMap.set(providerId, until);
  }

  public isResting(providerId: ProviderId): boolean {
    const until = this.restingMap.get(providerId);
    if (!until) return false;

    if (Date.now() >= until) {
      this.restingMap.delete(providerId);
      return false;
    }
    return true;
  }

  public getRestingUntil(providerId: ProviderId): Date | null {
    const until = this.restingMap.get(providerId);
    if (!until) return null;

    if (Date.now() >= until) {
      this.restingMap.delete(providerId);
      return null;
    }
    return new Date(until);
  }

  public clearResting(providerId: ProviderId): void {
    this.restingMap.delete(providerId);
  }

  public resetAll(): void {
    this.restingMap.clear();
  }
}
