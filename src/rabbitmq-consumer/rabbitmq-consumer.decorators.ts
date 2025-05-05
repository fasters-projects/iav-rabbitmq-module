import { SetMetadata } from '@nestjs/common';
import { Channel, ConsumeMessage } from 'amqplib';
// Constantes para metadados
export const RABBITMQ_CONSUMER = 'RABBITMQ_CONSUMER';
export const PARAMETER_TYPE = 'PARAMETER_TYPE';

// Interfaces
export interface RabbitMQConsumerOptions {
  queue: string;
  prefetch?: number;
  noAck?: boolean;
}

export interface ConsumerContext {
  channel: Channel;
  message: ConsumeMessage;
}


// Decorator principal para o consumer
export function RabbitMQConsumer(options: RabbitMQConsumerOptions) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    SetMetadata(RABBITMQ_CONSUMER, options)(target, key, descriptor);
    return descriptor;
  };
}

// Função de utilidade para criar decorators de parâmetros
function createParameterDecorator(type: string) {
  return (data?: any): ParameterDecorator => (target, key, index) => {
    const existingMetadata = key 
      ? Reflect.getMetadata(PARAMETER_TYPE, target.constructor, key) || {} 
      : {};
    
    existingMetadata[index] = { type, data };
    
    if (key !== undefined) {
      Reflect.defineMetadata(PARAMETER_TYPE, existingMetadata, target.constructor, key);
    }
  };
}

// Decorator para injetar o payload da mensagem
export const Payload = createParameterDecorator('payload');

// Decorator para injetar o contexto completo
export const Context = createParameterDecorator('context');