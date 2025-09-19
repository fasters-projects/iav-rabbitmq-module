
import { Channel, Message, Options } from 'amqplib';
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";

import { CustomHeaderNames, RabbitMQConnectionService } from 'src/rabbitmq-connection/rabbitmq-connection.service';
import { QueueBindConfig, RabbitSetupOptions } from './interfaces';
import { createDelayQueueName, createDlqQueueName, createExchangeDelayName, createExchangeDlxName, createExchangeRetryName, createRetryQueueName, createRoutingKeyDelayName, createRoutingKeyRetryName, createNumberedDelayQueueName, createRoutingKeyDlqName } from 'src/utils';
import { DelayStrategy } from './interfaces/delay-strategy.interface';
import { retryConsumer, RetryConsumerOptions } from './retry-consumers/retry-consumer';
import { FixedIntervalDelayStrategy } from './strategies/fixed-interval.strategy';


const DEFAULT_ROUTING_KEY = '';
const DEFAULT_DELAY_TIME = 1000 * 10 * 1; // 1 min
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_QUEUE_TYPE = 'quorum';

@Injectable()
export class RabbitSetupService<Q extends string, E extends string, R extends string> implements OnModuleInit {
  private channel: Channel;
  private createdExchanges: Set<string> = new Set();
  private queueOptions: Record<Q , { maxRetries?: number }> =
    {} as Record<Q, { delayTime?: number; maxRetries?: number }>;

  private connection: any;
  constructor(
    private readonly connectionService: RabbitMQConnectionService,
    @Inject('RABBIT_SETUP_OPTIONS') private options: RabbitSetupOptions<Q, E, R>
  ) {}

  async onModuleInit() {
    this.connection = await this.connectionService.connect();
    this.channel = this.connectionService.getChannel();

    this.channel.on('error', async (error) => {
      // eslint-disable-next-line
      console.log("channel error: ", error);
    });

    const queueSetups = this.options.queueSetups;

    for (const queueSetup of queueSetups) {
      await this.setupQueue(queueSetup);
    }
  }

  public async createExchange(
    exchangeName: string,
    exchangeType: string = 'topic',
  ): Promise<void> {
    if (this.channel === undefined)
      throw new Error('RabbitMQ connection failed!');
    const exchangeOptions = {
      durable: true,
      autoDelete: false,
    };

    try {
      await this.channel.assertExchange(
        exchangeName,
        exchangeType,
        exchangeOptions,
      );
    } catch (e) {
      if (process.env.NODE_ENV === 'dev') {
        await this.channel.deleteExchange(exchangeName);
        await this.channel.assertExchange(
          exchangeName,
          exchangeType,
          exchangeOptions,
        );
      } else {
        console.error(`Error asserting exchange ${exchangeName}`, e);
        throw e;
      }
    }
  }

  public async createDeadLetterQueue(
    queueName: string,
    deadLetterExchange: string,
  ): Promise<void> {
    const queueOptions = {
      durable: true,
      autoDelete: false,
      arguments: {
        'x-dead-letter-exchange': deadLetterExchange,
        'x-dead-letter-routing-key': DEFAULT_ROUTING_KEY,
        'x-queue-type': DEFAULT_QUEUE_TYPE,
      },
    };

    await this.assertQueue(queueName, queueOptions);
  }

  public async createDelayQueue(
    queueName: string,
    deadLetterExchange: string,    
    deadLetterRoutingkey: string = DEFAULT_ROUTING_KEY,
  ): Promise<void> {
    // Delay queues should not enforce TTL at the queue level; expiration is set on publish.
    const queueOptions = {
      durable: true,
      autoDelete: false,
      arguments: {
        'x-dead-letter-exchange': deadLetterExchange,
        'x-dead-letter-routing-key': deadLetterRoutingkey,
        'x-queue-type': DEFAULT_QUEUE_TYPE,
      },
    };

    await this.assertQueue(queueName, queueOptions);
  }

  public async bindQueue(
    exchange: string,
    queueName: string,
    routingKey = DEFAULT_ROUTING_KEY,
  ): Promise<void> {
    await this.channel.bindQueue(queueName, exchange, routingKey);
  }

  public async createQueue(
    queueName: string,
    deadLetterExchange: string,
    deadLetterRoutingkey: string = DEFAULT_ROUTING_KEY,
  ): Promise<void> {
    const queueOptions = {
      durable: true,
      autoDelete: false,
      arguments: {
        'x-dead-letter-exchange': deadLetterExchange,
        'x-dead-letter-routing-key': deadLetterRoutingkey,
        'x-queue-type': DEFAULT_QUEUE_TYPE,
      },
    };

    await this.assertQueue(queueName, queueOptions);
  }

  private async assertQueue(
    queueName: string,
    queueOptions?: Options.AssertQueue,
  ) {
    try {
      await this.channel.assertQueue(queueName, queueOptions);
      console.info(`Queue "${queueName}" created successfully.`);
    } catch (error: any) {
      if (process.env.NODE_ENV === 'dev' && error?.code === 406) {
        console.warn(
          `Queue "${queueName}" already exists with different arguments. Deleting and recreating it.`,
        );
        const channel = await this.connection.createChannel();
        await channel.deleteQueue(queueName, { ifUnused: false });
        await channel.close();
        await this.onModuleInit();
      } else {
        console.error(`Error creating queue "${queueName}":`, error);
        throw error;
      }
    }
  }

  // single retry consumer is implemented in separate file and used below

  private async closeConnection(): Promise<void> {
    await this.channel.close();
  }

  async setupQueue({    
    exchange,
    maxRetries = DEFAULT_MAX_RETRIES,
    queue,
    routingKeys,
    extraDlqQueue,
    delayTime,
    delayStrategy
  }: QueueBindConfig<Q, E, R>) {
    this.queueOptions[queue] = {
      maxRetries,
    };
    await this.setupExchangesWithRetryDlqAndDelay(exchange);
    await this.setupQueuesWithRetryAndDelay({
      queue,
      exchange,
      routingKeys, 
      delayStrategy,
      delayTime,   
    });

     if(extraDlqQueue)
      await this.createExtraDlqQueue(extraDlqQueue, exchange, queue)
  }

  async setupExchangesWithRetryDlqAndDelay(exchange: string) {
    if (!this.createdExchanges.has(exchange)) {
      this.createdExchanges.add(exchange);

      const exchangeRetry = createExchangeRetryName(exchange);
      const exchangeDelay = createExchangeDelayName(exchange);
      const exchangeDlx = createExchangeDlxName(exchange);

      await this.createExchange(exchange, 'topic');
      await this.createExchange(exchangeRetry, 'topic');
      await this.createExchange(exchangeDelay, 'topic');
      await this.createExchange(exchangeDlx, 'topic');
    }
  }

  async setupQueuesWithRetryAndDelay({    
    exchange,
    queue,
    routingKeys,
    delayTime = DEFAULT_DELAY_TIME,
    delayStrategy,
  }: QueueBindConfig<Q, E, R>) {
    const retryRoutingKey = createRoutingKeyRetryName(queue);
    const dlqRoutingKey = createRoutingKeyDlqName(queue);

    const exchangeRetry = createExchangeRetryName(exchange);
    const exchangeDelay = createExchangeDelayName(exchange);
    const exchangeDlx = createExchangeDlxName(exchange);

    const queueRetry = createRetryQueueName(queue);
    const queueDlq = createDlqQueueName(queue);

    // main queue: dead-letter to retry exchange using retryRoutingKey
    await this.createQueue(
      queue,
      exchangeRetry,
      retryRoutingKey,
    );

    // bind main queue to main exchange routing keys
    for (const key of routingKeys) {
      await this.bindQueue(exchange, queue, key);
    }

    // create numbered delay queues for each retry step; they dead-letter back to main exchange using main routing key
    const mainRoutingKey = routingKeys && routingKeys.length ? routingKeys[0] : DEFAULT_ROUTING_KEY;
    const maxRetries = this.queueOptions[queue]?.maxRetries ?? DEFAULT_MAX_RETRIES;
    for (let step = 1; step <= maxRetries; step++) {
      const numberedDelayQueue = createNumberedDelayQueueName(queue, step);
      await this.createDelayQueue(numberedDelayQueue, exchange, mainRoutingKey);
      const routingKeyForStep = createRoutingKeyDelayName(queue, step);
      await this.bindQueue(exchangeDelay, numberedDelayQueue, routingKeyForStep);
    }

    // retry queue: dead-letter to final DLX exchange (use createQueue so we can set routing key)
    await this.createQueue(
      queueRetry,
      exchangeDlx,
      dlqRoutingKey,
    );

    // final DLQ (no DLX)
    await this.createQueue(queueDlq, '');
    
    await this.bindQueue(exchangeRetry, queueRetry, retryRoutingKey);      
    await this.bindQueue(exchangeDlx, queueDlq, dlqRoutingKey);    
    

    await this.createRetryConsumer({
      exchange,    
      delayStrategy,
      delayTime,
      queue,
    } as QueueBindConfig<Q, E, R>);
  }

  private createRetryConsumer( {
    exchange,    
    delayStrategy,
    delayTime,
    queue,
  }: QueueBindConfig<Q, E, R>) {
    const exchangeDelay = createExchangeDelayName(exchange);
    const queueRetry = createRetryQueueName(queue);
    const retryConsumerOptions: RetryConsumerOptions = {
      exchangeDelay,
      maxRetries: this.queueOptions[queue]?.maxRetries ?? DEFAULT_MAX_RETRIES,
      defaultDelayMs: delayTime,
    };

    
    const strategy: DelayStrategy<string> = delayStrategy ?? new FixedIntervalDelayStrategy(
      delayTime, 
      this.queueOptions[queue]?.maxRetries ?? DEFAULT_MAX_RETRIES
    );
    retryConsumer(this.channel, queueRetry, retryConsumerOptions, strategy);
  }

  private async createExtraDlqQueue(queue: Q, exchange: string, originalQueue: Q) {
    
    const exchangeDlxName = createExchangeDlxName(exchange);
    const routingKey = createRoutingKeyDlqName(originalQueue);
    
    await this.createDeadLetterQueue(queue, '');
    await this.bindQueue(exchangeDlxName, queue, routingKey);
  }

}
