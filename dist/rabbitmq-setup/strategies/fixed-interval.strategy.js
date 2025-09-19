"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixedIntervalDelayStrategy = void 0;
class FixedIntervalDelayStrategy {
    constructor(intervalMs = 1000, levels = 5) {
        this.intervalMs = intervalMs;
        this.levels = levels;
    }
    decide(originalQueue, retryCount, maxRetries) {
        if (retryCount > maxRetries)
            return;
        const idx = Math.min(Math.max(1, retryCount), this.levels);
        return { step: idx, expirationMs: this.intervalMs };
    }
}
exports.FixedIntervalDelayStrategy = FixedIntervalDelayStrategy;
//# sourceMappingURL=fixed-interval.strategy.js.map