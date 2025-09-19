import { Channel } from 'amqplib';
import { DelayStrategy } from '../interfaces/delay-strategy.interface';
export interface RetryConsumerOptions {
    exchangeDelay: string;
    maxRetries: number;
    defaultDelayMs?: number;
}
export declare function retryConsumer(channel: Channel, retryQueueName: string, opts: RetryConsumerOptions, strategy: DelayStrategy<string>): void;
