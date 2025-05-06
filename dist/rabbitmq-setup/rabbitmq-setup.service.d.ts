import { OnModuleInit } from "@nestjs/common";
import { RabbitMQConnectionService } from '../rabbitmq-connection/rabbitmq-connection.service';
import { QueueBindConfig, RabbitSetupOptions } from './interfaces';
export declare class RabbitSetupService<Q extends string, E extends string, R extends string> implements OnModuleInit {
    private readonly connectionService;
    private options;
    private channel;
    private createdExchanges;
    private queueOptions;
    private connection;
    constructor(connectionService: RabbitMQConnectionService, options: RabbitSetupOptions<Q, E, R>);
    onModuleInit(): Promise<void>;
    createExchange(exchangeName: string, exchangeType?: string): Promise<void>;
    createDeadLetterQueue(queueName: string, deadLetterExchange: string): Promise<void>;
    createDelayQueue(queueName: string, deadLetterExchange: string, delayTime?: number, deadLetterRoutingkey?: string): Promise<void>;
    bindQueue(exchange: string, queueName: string, routingKey?: string): Promise<void>;
    createQueue(queueName: string, deadLetterExchange: string, deadLetterRoutingkey?: string): Promise<void>;
    private assertQueue;
    createRetryQueueConsumer(retryQueueName: string): Promise<void>;
    private closeConnection;
    setupQueue({ delayTime, exchange, maxRetries, queue, routingKeys, }: QueueBindConfig<Q, E, R>): Promise<void>;
    setupExchangesWithRetryDlqAndDelay(exchange: string): Promise<void>;
    setupQueuesWithRetryAndDelay({ delayTime, exchange, queue, routingKeys, }: QueueBindConfig<Q, E, R>): Promise<void>;
}
