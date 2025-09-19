import { DelayDecision, DelayStrategy } from '../interfaces/delay-strategy.interface';
export declare class FixedIntervalDelayStrategy<Q extends string = string> implements DelayStrategy<Q> {
    private readonly intervalMs;
    private readonly levels;
    constructor(intervalMs?: number, levels?: number);
    decide(originalQueue: Q, retryCount: number, maxRetries: number): DelayDecision<Q>;
}
