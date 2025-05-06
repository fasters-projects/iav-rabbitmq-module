export interface QueueBindConfig<Q, E, R> {
    queue: Q;
    exchange: E;
    routingKeys: R[];
    delayTime?: number;
    maxRetries?: number;
}
