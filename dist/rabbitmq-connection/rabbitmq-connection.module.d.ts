import { DynamicModule } from '@nestjs/common';
import { RabbitMQConfigModuleOptions } from './rabbitmq-connection.service';
export declare class RabbitMQConnectionModule {
    static register(options: RabbitMQConfigModuleOptions): DynamicModule;
}
