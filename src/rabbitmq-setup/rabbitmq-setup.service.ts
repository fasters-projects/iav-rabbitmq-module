
import { Channel, Message, Options } from 'amqplib';
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";

import { CustomHeaderNames, RabbitMQConnectionService } from 'src/rabbitmq-connection/rabbitmq-connection.service';
import { QueueBindConfig, RabbitSetupOptions } from './interfaces';
import { createDelayQueueName, createDlqQueueName, createExchangeDelayName, createExchangeDlxName, createExchangeRetryName, createRetryQueueName, createRoutingKeyDelayName, createRoutingKeyDlqName, createRoutingKeyRetryName } from 'src/utils';

const DEFAULT_ROUTING_KEY = '';
const DEFAULT_DELAY_TIME = 1000 * 60 * 1; // 1 min
const DEFAULT_MAX_RETRIES = 4;
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

  public async createDelayQueue(
    queueName: string,
    deadLetterExchange: string,
    delayTime: number = DEFAULT_DELAY_TIME,
    deadLetterRoutingkey: string = DEFAULT_ROUTING_KEY,
    maxRetries: number = DEFAULT_MAX_RETRIES
  ): Promise<void> {    
    const queueOptions = {
      durable: true,
      autoDelete: false,
      arguments: {
        'x-dead-letter-exchange': deadLetterExchange,
        'x-dead-letter-routing-key': deadLetterRoutingkey,
        'x-max-retries': maxRetries,
        'x-message-ttl': delayTime,
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
        if(!this.connection)
          this.connection = await this.connectionService.connect();
        const channel = await this.connectionService.getChannel();
        await channel.deleteQueue(queueName, { ifUnused: false });
        await channel.close();
        await this.onModuleInit();
      } else {
        console.error(`Error creating queue "${queueName}":`, error);
        throw error;
      }
    }
  }

  async createRetryQueueConsumer(retryQueueName: string) {
    this.channel.consume(retryQueueName, async (message: Message | null) => {
      if (!message) {
        console.info("Message doesn't exist. Queue: ", retryQueueName);
        return;
      }
      const headers = message.properties.headers || {};
      try {
       
        const originQueue = headers[CustomHeaderNames.FirstDeathQueue];
        const currentCount = headers[CustomHeaderNames.RetryCount]
          ? parseInt(headers[CustomHeaderNames.RetryCount], 10)
          : 1;
        const maxRetries =
          this.queueOptions[originQueue as Q]?.maxRetries || 0;

        if (currentCount > maxRetries+1) {
          console.warn(
            `Max retryes reached: ${originQueue}, sending to DLQ. message: ${message.content.toString()}`,
          );
          this.channel.nack(message as Message, false, false);
          return;
        }

        headers[CustomHeaderNames.RetryCount] = currentCount + 1;

        console.info(
          `Resending Message to queue ${originQueue}: Message :${message.content.toString()}`,
        );
        this.channel.sendToQueue(originQueue as string, message.content, {
          headers: headers,
        });
        this.channel.ack(message);
      } catch (error) {
        console.info(`ErrorIn Queue: ${retryQueueName}, sending to DLQ`);
        headers[CustomHeaderNames.LastError] = error;
        this.channel.nack(message as Message, false, false);
      }
    });
  }

  private async closeConnection(): Promise<void> {
    await this.channel.close();
  }

  async setupQueue({
    delayTime = DEFAULT_DELAY_TIME,
    exchange,
    maxRetries = DEFAULT_MAX_RETRIES,
    queue,
    routingKeys,
    extraDlqQueue,
  }: QueueBindConfig<Q, E, R>) {
    this.queueOptions[queue] = {
      maxRetries,
    };
    await this.setupExchangesWithRetryDlqAndDelay(exchange);
    await this.setupQueuesWithRetryAndDelay({
      queue,
      exchange,
      routingKeys,
      delayTime,
      maxRetries
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
    delayTime,
    exchange,
    queue,
    routingKeys,
    maxRetries,
  }: QueueBindConfig<Q, E, R>) {
    const delayDlqRoutingKey = createRoutingKeyDelayName(queue);
    const retryDlqRoutingKey = createRoutingKeyRetryName(queue);
    const mainDlqRoutingKey = createRoutingKeyDlqName(queue);

    const exchangeRetry = createExchangeRetryName(exchange);
    const exchangeDelay = createExchangeDelayName(exchange);
    const exchangeDlx = createExchangeDlxName(exchange);    

    const queueDelay = createDelayQueueName(queue);
    const queueRetry = createRetryQueueName(queue);
    const queueDlq = createDlqQueueName(queue);

    await this.createQueue(
      queue,
      exchangeDelay,
      delayDlqRoutingKey,
    );

    for (const key of routingKeys) {
      await this.bindQueue(exchange, queue, key);
    }

    await this.createDelayQueue(
      queueDelay,
      exchangeRetry,
      delayTime,
      retryDlqRoutingKey,
      maxRetries
    );
    await this.createDeadLetterQueue(
      queueRetry,
      exchangeDlx,
      mainDlqRoutingKey
    );
    await this.createDeadLetterQueue(queueDlq, '');

    await this.bindQueue(
      exchangeRetry,
      queueRetry,
      retryDlqRoutingKey,
    );
    await this.bindQueue(
      exchangeDelay,
      queueDelay,
      delayDlqRoutingKey,
    );
    await this.bindQueue(exchangeDlx, queueDlq, mainDlqRoutingKey);

    await this.createRetryQueueConsumer(queueRetry);
  }

  private async createExtraDlqQueue(queue: Q, exchange: string, originalQueue: Q) {
    
    const exchangeDlxName = createExchangeDlxName(exchange);
    const routingKey = createRoutingKeyDlqName(originalQueue);
    
    await this.createDeadLetterQueue(queue, '');
    await this.bindQueue(exchangeDlxName, queue, routingKey);
  }

}
