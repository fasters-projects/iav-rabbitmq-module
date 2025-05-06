import { OnModuleInit } from "@nestjs/common";
import { DiscoveryService } from '@nestjs/core';
import { Channel, Message } from 'amqplib';
import { RabbitMQConnectionService } from "src/rabbitmq-connection/rabbitmq-connection.service";
export interface MessageConsumerContext {
    channel: Channel;
    message: Message;
}
export declare class RabbitMQConsumerProvider implements OnModuleInit {
    private readonly discoveryService;
    private readonly connectionService;
    private connection;
    private channel;
    private readonly reflector;
    constructor(discoveryService: DiscoveryService, connectionService: RabbitMQConnectionService);
    onModuleInit(): Promise<void>;
    private setupConsumers;
    private processProviders;
    private processInstance;
    private getMethodNames;
    private setupConsumerIfApplicable;
    private resolveConsumerParams;
}
