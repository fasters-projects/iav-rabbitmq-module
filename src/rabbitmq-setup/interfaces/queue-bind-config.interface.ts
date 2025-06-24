export interface QueueBindConfig<Q, E, R> {
  queue: Q;
  exchange: E;
  routingKeys: R[];
  extraDlqQueue?: Q
  delayTime?: number;
  maxRetries?: number;
};
