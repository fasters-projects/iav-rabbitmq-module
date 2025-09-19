import { DelayDecision, DelayStrategy } from '../interfaces/delay-strategy.interface';

export class ExponentialDelayStrategy<Q extends string = string> implements DelayStrategy<Q> {
	constructor(
		private readonly baseMs: number = 1000,
		private readonly multiplier: number = 2,
		private readonly maxMs: number = 1000 * 60 * 30,
		private readonly levels: number = 5,
	) {}

	decide(originalQueue: Q, retryCount: number, maxRetries: number): DelayDecision<Q> {
		if (retryCount > maxRetries) return;
		const idx = Math.min(Math.max(1, retryCount), this.levels);
		const delay = Math.min(this.maxMs, Math.round(this.baseMs * Math.pow(this.multiplier, retryCount - 1)));
		return { step: idx, expirationMs: delay };
	}
}
