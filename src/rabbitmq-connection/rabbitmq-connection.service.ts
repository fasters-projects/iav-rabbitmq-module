import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Channel, ChannelModel, connect, ConsumeMessage, Options, Replies } from "amqplib";

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
  LastDeathQueue = 'x-last-death-queue',
  RetryCount = 'x-retry-count',
  LastError = 'x-last-error',
  ApplicationSource = 'x-application-source'
}

interface ConsumerDef {
  queue: string;
  onMessage: (msg: ConsumeMessage | null) => void;
  options?: Options.Consume;
}

const baseDelay = 2000;       // 2s
const maxDelay = 600_000;     // 10 minutos

@Injectable()
export class RabbitMQConnectionService implements OnModuleDestroy, OnModuleInit {

  private channel: Channel;
  private connection: ChannelModel;
  private reconnectAttempts: number = 0;
  private consumers: ConsumerDef[] = [];
  private proxyChannel: Channel;

  constructor(
      @Inject(RABBITMQ_OPTIONS) private options: RabbitMQConfigModuleOptions,      
    ) {

      this.proxyChannel = new Proxy({} as Channel, {
      get: (_, prop) => {
        if (!this.channel) {
          throw new Error('Channel not available (disconnected)');
        }
        // delega pro channel atual
        const value = (this.channel as any)[prop];
        return typeof value === 'function' ? value.bind(this.channel) : value;
      },
    });
  }

  async onModuleInit() {
    if(this.options.autoConnect === true)
      await this.connect()
  }

  async connect() {
    if (!this.connection) {
      console.log("Connecting to rabbitmq...");
      this.connection = await connect(this.options.url)
      this.channel = await this.connection.createConfirmChannel();

      const originalConsume = this.channel.consume.bind(this.channel);
      this.channel.consume = async (queue: string, onMessage: (msg: ConsumeMessage) => void, options?: Options.Consume) : Promise<Replies.Consume> => {
        // salvar consumidor
        this.consumers.push({ queue, onMessage, options });
        return originalConsume(queue, onMessage, options) as Replies.Consume;
      };
      
      this.connection.on("error", (err) => {
        console.error("Erro na conexão RabbitMQ:", err.message);
      });

      this.connection.on("close", () => {
        console.warn("Conexão RabbitMQ fechada, tentando reconectar...");
        this.reconnect();
      });
      console.log("Connected to rabbitmq");

      if(this.consumers.length > 0) {
        console.log("Registrando consumidores novamente...");
        for (const c of this.consumers) {
          console.log("Registrando consumidor:", c.queue);
          await originalConsume(c.queue, c.onMessage, c.options);
        }
      }
    }
    return this.connection
  }

  private async reconnect() {
    this.connection = null;
    this.channel = null;

    this.reconnectAttempts++;
    const delay = Math.min(
      baseDelay * Math.pow(2, this.reconnectAttempts),
      maxDelay
    );

    console.log(`Tentando reconectar em ${delay / 1000}s... (tentativa ${this.reconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
        this.reconnectAttempts = 0        
      } catch (err) {
        console.error("Erro inesperado ao tentar reconectar:", (err as Error).message);
        this.reconnect(); 
      }     
    }, delay);
  }

  getChannel(): Channel {
    if (this.proxyChannel === undefined || this.channel === undefined)
      throw new Error('RabbitMQ connection failed!');
    return this.proxyChannel;
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