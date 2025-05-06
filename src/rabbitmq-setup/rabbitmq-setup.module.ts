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
