import { DynamicModule, Global, Module } from '@nestjs/common';
import { RABBITMQ_OPTIONS, RabbitMQConfigModuleOptions, RabbitMQConnectionService } from './rabbitmq-connection.service';

@Global()
@Module({})
export class RabbitMQConnectionModule {
  static register(options: RabbitMQConfigModuleOptions): DynamicModule {
      return {
        module: RabbitMQConnectionModule,
        providers: [
          {
            provide: RABBITMQ_OPTIONS,
            useValue: options,
          },
          RabbitMQConnectionService,
        ],
        exports: [RabbitMQConnectionService],
      };
    }
}
