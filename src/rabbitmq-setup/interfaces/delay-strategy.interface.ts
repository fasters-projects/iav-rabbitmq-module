export interface DelayDecision<Q = string> {
	targetDelayQueue?: Q | null;
	expirationMs?: number;
	step?: number;
	routingKey?: string;
}

export interface DelayStrategy<Q = string> {
	decide(originalQueue: Q, retryCount: number, maxRetries: number): DelayDecision<Q> | undefined;
}
