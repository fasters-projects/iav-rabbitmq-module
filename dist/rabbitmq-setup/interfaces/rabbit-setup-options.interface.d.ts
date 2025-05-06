import { QueueBindConfig } from './queue-bind-config.interface';
export interface RabbitSetupOptions<Q, E, R> {
    queueSetups: QueueBindConfig<Q, E, R>[];
}
