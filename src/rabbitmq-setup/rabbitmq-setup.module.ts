import { DynamicModule, Module } from '@nestjs/common';
import { RabbitSetupService } from './rabbitmq-setup.service';
import { RabbitMQConnectionModule } from 'src/rabbitmq-connection/rabbitmq-connection.module';
import { RabbitSetupOptions } from './interfaces';

@Module({
  exports: [RabbitSetupService],
  providers: [RabbitSetupService],
  imports:[RabbitMQConnectionModule]
})
export class RabbitmqSetupModule<Q,E,R> {

  /**
   * Registers the RabbitMQ Setup module with the given options
   * 
   * The generic types Q, E and R are used to specify the types of the queue, exchange and routing keys. They can be Enums of strings for type cheching
   *    
   * @param options The binding options for the RabbitMQ Setup module @see RabbitSetupOptions
   * @returns A dynamic module with the RabbitMQ Setup service as a provider and export
   */
  static register<Q,E,R>(options: RabbitSetupOptions<Q,E,R>): DynamicModule {
    return {
      module: RabbitmqSetupModule,
      imports: [RabbitMQConnectionModule],
      providers: [
        {
          provide: 'RABBIT_SETUP_OPTIONS',
          useValue: options,
        },
        RabbitSetupService,
      ],
      exports: [RabbitSetupService],
    };
  }
}
