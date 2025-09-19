"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExponentialDelayStrategy = void 0;
class ExponentialDelayStrategy {
    constructor(baseMs = 1000, multiplier = 2, maxMs = 1000 * 60 * 30, levels = 5) {
        this.baseMs = baseMs;
        this.multiplier = multiplier;
        this.maxMs = maxMs;
        this.levels = levels;
    }
    decide(originalQueue, retryCount, maxRetries) {
        if (retryCount > maxRetries)
            return;
        const idx = Math.min(Math.max(1, retryCount), this.levels);
        const delay = Math.min(this.maxMs, Math.round(this.baseMs * Math.pow(this.multiplier, retryCount - 1)));
        return { step: idx, expirationMs: delay };
    }
}
exports.ExponentialDelayStrategy = ExponentialDelayStrategy;
//# sourceMappingURL=exponential-delay.strategy.js.map