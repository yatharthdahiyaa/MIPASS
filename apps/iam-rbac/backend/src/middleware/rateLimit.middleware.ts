import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const ipStore = new Map<string, RateLimitRecord>();

// Clean up stale IP records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipStore.entries()) {
    if (now > record.resetAt) {
      ipStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);

export function rateLimitByIp(maxRequests: number = 20, windowMs: number = 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = (req.ip || req.socket.remoteAddress || 'unknown-ip').toString();
    const now = Date.now();

    const record = ipStore.get(ip);

    if (!record || now > record.resetAt) {
      ipStore.set(ip, {
        count: 1,
        resetAt: now + windowMs,
      });
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        success: false,
        error: 'TooManyRequests',
        message: 'Too many authentication attempts from this IP address. Please slow down.',
        retryAfterSeconds,
      });
      return;
    }

    record.count += 1;
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    next();
  };
}
