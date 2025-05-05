import { DynamicModule, Module } from '@nestjs/common';
import { RabbitSetupService } from './rabbitmq-setup.service';
import { RabbitMQConnectionModule } from 'src/rabbitmq-connection/rabbitmq-connection.module';

@Module({
  exports: [RabbitSetupService],
  providers: [RabbitSetupService],
  imports:[RabbitMQConnectionModule]
})
export class RabbitmqSetupModule<Q,E,R> {

  static register<Q,E,R>(options: RabbitmqSetupModule<Q,E,R>): DynamicModule {
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
