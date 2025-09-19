import { DelayDecision, DelayStrategy } from '../interfaces/delay-strategy.interface';

export class FixedIntervalDelayStrategy<Q extends string = string> implements DelayStrategy<Q> {
	constructor(private readonly intervalMs: number = 1000, private readonly levels: number = 5) {}

	decide(originalQueue: Q, retryCount: number, maxRetries: number): DelayDecision<Q> {
		if (retryCount > maxRetries) return;
		const idx = Math.min(Math.max(1, retryCount), this.levels);
		return { step: idx, expirationMs: this.intervalMs };
	}
}
