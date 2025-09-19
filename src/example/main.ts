import { RabbitMQConnectionService, CustomHeaderNames } from '../rabbitmq-connection/rabbitmq-connection.service';
import { RabbitSetupService } from '../rabbitmq-setup/rabbitmq-setup.service';
import { FixedIntervalDelayStrategy } from '../rabbitmq-setup/strategies/fixed-interval.strategy';
import { createExchangeRetryName, createRoutingKeyRetryName, createDlqQueueName } from '../utils';

async function main() {
  const rabbitOptions = { url: process.env.RABBITMQ_URL ?? 'amqp://admin:admin@localhost:5672', autoConnect: false };
  const connectionService = new RabbitMQConnectionService(rabbitOptions as any);
  const extraDlq = createDlqQueueName('test.queue-extra');
  const setupOptions = {
    queueSetups: [
      {
        queue: 'test.queue',
        exchange: 'app.exchange',
        routingKeys: ['rk.test'],
        maxRetries: 3,
        delayStrategy: new FixedIntervalDelayStrategy(3000, 3),
      },
    ],
  } as any;

  const setupService = new RabbitSetupService(connectionService as any, setupOptions);

  console.info('Initializing setup (creating exchanges/queues and registering retry consumer)...');
  await setupService.onModuleInit();

  const channel = connectionService.getChannel();

  await channel.consume('test.queue', async (msg) => {
    if (!msg) return;
    const body = msg.content.toString();
    console.info('[main.consumer] received message:', body, 'headers:', msg.properties.headers);

    const exchangeRetry = createExchangeRetryName('app.exchange');
    const routingKeyRetry = createRoutingKeyRetryName('test.queue');   

    console.info('[main.consumer] forwarding to retry exchange:', exchangeRetry, 'routingKey:', routingKeyRetry);
    channel.nack(msg, false, false);
  });

  // Consumer on final DLQ to observe when messages arrive after retries/delays
  const finalDlq = extraDlq
  await channel.consume(finalDlq, async (msg) => {
    if (!msg) return;
    const receiveAt = new Date().toISOString();
    console.info('[final.dlq] received message at', receiveAt, 'body:', msg.content.toString());
    console.info('[final.dlq] headers:', msg.properties.headers);
    channel.ack(msg);
  });

  // Publish a test message to the main exchange so it lands in the main queue
  const publishPayload = { id: 'm1', text: 'test message', ts: Date.now() };  
  console.info('[example] publishing test message to app.exchange -> rk.test', publishPayload);
  connectionService.publish({ exchange: 'app.exchange', routingKey: 'rk.test', message: publishPayload, origin: 'example' });
  console.info('[example] waiting to observe retry/delay flow; watch logs for final DLQ arrivals');
}

main().catch((err) => {
  console.error('Example failed', err);
  process.exit(1);
});