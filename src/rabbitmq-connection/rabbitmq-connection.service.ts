import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Channel, ChannelModel, connect } from "amqplib";

export const RABBITMQ_OPTIONS = 'RABBITMQ_OPTIONS';
export interface RabbitMQConfigModuleOptions {
  url: string;  
  autoConnect: boolean
}

export interface PublishOptions {
  exchange: string, 
  routingKey: string, 
  message: any,
  origin: string,
}

export enum CustomHeaderNames {
  FirstDeathQueue = 'x-first-death-queue',
  RetryCount = 'x-retry-count',
  LastError = 'x-last-error',
  ApplicationSource = 'x-application-source'
}

@Injectable()
export class RabbitMQConnectionService implements OnModuleDestroy, OnModuleInit {

  private channel: Channel;
  private connection: ChannelModel;

  constructor(
      @Inject(RABBITMQ_OPTIONS) private options: RabbitMQConfigModuleOptions,      
    ) {}

  async onModuleInit() {
    if(this.options.autoConnect === true)
      await this.connect()
  }

  async connect() {
    if (!this.connection) {
      console.log("connecting to rabbitmq...");
      this.connection = await connect(this.options.url)
      this.channel = await this.connection.createConfirmChannel();
    }
    return this.connection
  }

  getChannel(): Channel {
    if (this.channel === undefined)
      throw new Error('RabbitMQ connection failed!');
    return this.channel;
  }

  publish(publishOptions: PublishOptions): Boolean {
    if (this.channel === undefined)
      throw new Error('RabbitMQ not connected!');
    
    return this.channel.publish(publishOptions.exchange, publishOptions.routingKey, Buffer.from(JSON.stringify(publishOptions.message)), {
      headers: {
        'x-application-origin': publishOptions.origin,
      }
    })
  }  

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}