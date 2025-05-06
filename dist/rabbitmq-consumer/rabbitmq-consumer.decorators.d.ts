import { Channel, ConsumeMessage } from 'amqplib';
export declare const RABBITMQ_CONSUMER = "RABBITMQ_CONSUMER";
export declare const PARAMETER_TYPE = "PARAMETER_TYPE";
export interface RabbitMQConsumerOptions {
    queue: string;
    prefetch?: number;
    noAck?: boolean;
}
export interface ConsumerContext {
    channel: Channel;
    message: ConsumeMessage;
}
export declare function RabbitMQConsumer(options: RabbitMQConsumerOptions): (target: any, key: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export declare const Payload: (data?: any) => ParameterDecorator;
export declare const Context: (data?: any) => ParameterDecorator;
