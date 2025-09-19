import { QueueBindConfig } from './queue-bind-config.interface';
import { DelayStrategy } from './delay-strategy.interface';

export interface RabbitSetupOptions<Q, E, R> {
  queueSetups: QueueBindConfig<Q, E, R>[];
}