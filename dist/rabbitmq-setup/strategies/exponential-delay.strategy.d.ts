import { DelayDecision, DelayStrategy } from '../interfaces/delay-strategy.interface';
export declare class ExponentialDelayStrategy<Q extends string = string> implements DelayStrategy<Q> {
    private readonly baseMs;
    private readonly multiplier;
    private readonly maxMs;
    private readonly levels;
    constructor(baseMs?: number, multiplier?: number, maxMs?: number, levels?: number);
    decide(originalQueue: Q, retryCount: number, maxRetries: number): DelayDecision<Q>;
}
