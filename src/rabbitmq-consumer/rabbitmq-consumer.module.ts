import { Module } from '@nestjs/common';
import { RabbitMQConsumerProvider } from './rabbitmq-consumer.provider';
import { DiscoveryModule } from '@nestjs/core';
import { RabbitMQConnectionModule } from 'src/rabbitmq-connection/rabbitmq-connection.module';



@Module({  
  imports: [
    DiscoveryModule,
    RabbitMQConnectionModule
  ],
  exports: [RabbitMQConsumerProvider],
  providers: [RabbitMQConsumerProvider],
})
export class RabbitmqConsumerModule {


}
