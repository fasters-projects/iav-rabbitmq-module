import { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Channel } from "amqplib";
export declare const RABBITMQ_OPTIONS = "RABBITMQ_OPTIONS";
export interface RabbitMQConfigModuleOptions {
    url: string;
    autoConnect: boolean;
}
export interface PublishOptions {
    exchange: string;
    routingKey: string;
    message: any;
    origin: string;
}
export declare enum CustomHeaderNames {
    FirstDeathQueue = "x-first-death-queue",
    RetryCount = "x-retry-count",
    LastError = "x-last-error",
    ApplicationSource = "x-application-source"
}
export declare class RabbitMQConnectionService implements OnModuleDestroy, OnModuleInit {
    private options;
    private channel;
    private connection;
    constructor(options: RabbitMQConfigModuleOptions);
    onModuleInit(): Promise<void>;
    connect(): Promise<void>;
    getChannel(): Channel;
    publish(publishOptions: PublishOptions): Boolean;
    onModuleDestroy(): Promise<void>;
}
