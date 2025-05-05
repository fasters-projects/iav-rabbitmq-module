import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, ModuleRef, Reflector } from '@nestjs/core';
import { RABBITMQ_CONSUMER, PARAMETER_TYPE } from './rabbitmq-consumer.decorators';
import { connect, Connection, Channel, Message } from 'amqplib';

import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import {  RabbitMQConnectionService } from "src/rabbitmq-connection/rabbitmq-connection.service";

export interface MessageConsumerContext {
  channel: Channel;
  message: Message;
}

@Injectable()
export class RabbitMQConsumerProvider implements OnModuleInit {
  private connection: Connection;
  private channel: Channel;
  private readonly reflector = new Reflector();

  constructor(    
    private readonly discoveryService: DiscoveryService,
    private readonly connectionService: RabbitMQConnectionService,
  ) {}

  async onModuleInit() {
    await this.connectionService.connect();
    this.channel = this.connectionService.getChannel();
    // Descobrir e configurar os consumidores
    this.setupConsumers();
  }

 

  private async setupConsumers() {
    const providers = this.discoveryService.getProviders();
    const controllers = this.discoveryService.getControllers();
    
    // Processamos tanto providers quanto controllers
    await this.processProviders(providers);
    await this.processProviders(controllers);
  }

  private async processProviders(wrappers: InstanceWrapper[]) {
    for (const wrapper of wrappers) {
      const { instance } = wrapper;
      
      if (!instance) continue;
      
      await this.processInstance(instance);
    }
  }

  private async processInstance(instance: any) {
    
    const prototype = Object.getPrototypeOf(instance);
    if (!prototype) return;
    
    
    const methodNames = this.getMethodNames(prototype);
    
    for (const methodName of methodNames) {
      await this.setupConsumerIfApplicable(instance, methodName);
    }
  }

  private getMethodNames(prototype: any): string[] {
    
    const properties = new Set<string>();
    let currentPrototype = prototype;
    
    
    while (currentPrototype && currentPrototype !== Object.prototype) {
      Object.getOwnPropertyNames(currentPrototype)
        .filter(prop => {
          const descriptor = Object.getOwnPropertyDescriptor(currentPrototype, prop);
          return prop !== 'constructor' && descriptor && typeof descriptor.value === 'function';
        })
        .forEach(prop => properties.add(prop));
  
      currentPrototype = Object.getPrototypeOf(currentPrototype);
    }
    
    return Array.from(properties);
  }

  private async setupConsumerIfApplicable(instance: any, methodName: string) {
    
    const consumerMetadata = this.reflector.get(
      RABBITMQ_CONSUMER,
      instance.constructor.prototype[methodName],
    );
    
    if (!consumerMetadata) {
      return;
    }
    
    const { queue, prefetch = 1, noAck = false } = consumerMetadata;
    
    
    const paramMetadata = Reflect.getMetadata(
      PARAMETER_TYPE, 
      instance.constructor, 
      methodName
    ) || {};

    
    await this.channel.prefetch(prefetch);
    
    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;
      
      try {
        const context: MessageConsumerContext = { channel: this.channel, message: msg };
        const args = this.resolveConsumerParams(paramMetadata, msg, context);
        
        await instance[methodName](...args);
        
        if (!noAck) {
          this.channel.ack(msg);
        }
      } catch (error) {
        console.error(`Erro ao processar mensagem da fila ${queue}:`, error);
        if (!noAck) {
          this.channel.nack(msg, false, false);
        }
      }
    });
    
    console.log(`Consumer configurado para a fila ${queue}`);
  }

  private resolveConsumerParams(
    paramMetadata: Record<number, { type: string; data: any }>,
    msg: any,
    context: any,
  ): any[] {
    const params: any[] = [];
    
    const maxIndex = Math.max(...Object.keys(paramMetadata).map(Number), -1);
    
    for (let i = 0; i <= maxIndex; i++) {
      const param = paramMetadata[i];
      
      if (!param) {
        params.push(undefined);
        continue;
      }
      
      switch (param.type) {
        case 'payload':
          try {
            params.push(JSON.parse(msg.content.toString()));
          } catch (err) {
            console.log('Conteúdo não é um JSON válido:', msg.content.toString());
            params.push(msg.content.toString());
          }
          break;
        case 'context':
          params.push(context);
          break;
        default:
          params.push(undefined);
      }
    }
    
    return params;
  }
}