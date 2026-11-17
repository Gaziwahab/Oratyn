interface Bucket {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  consume(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const existing = this.buckets.get(key) ?? { timestamps: [] };
    const recent = existing.timestamps.filter((t) => t > cutoff);

    if (recent.length >= this.maxRequests) {
      const oldest = recent[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      this.buckets.set(key, { timestamps: recent });
      return { allowed: false, retryAfterSeconds };
    }

    recent.push(now);
    this.buckets.set(key, { timestamps: recent });
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
