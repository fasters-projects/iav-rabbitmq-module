import { DelayStrategy } from "./delay-strategy.interface";

export interface QueueBindConfig<Q, E, R> {
  queue: Q;
  exchange: E;
  routingKeys: R[];
  delayTime?: number;
  extraDlqQueue?: Q;
  maxRetries?: number;
  delayStrategy?: DelayStrategy<Q>;
};
