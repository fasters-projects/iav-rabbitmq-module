import { RabbitMQConnectionService, CustomHeaderNames } from '../rabbitmq-connection/rabbitmq-connection.service';
import { RabbitSetupService } from '../rabbitmq-setup/rabbitmq-setup.service';
import { ExponentialDelayStrategy } from '../rabbitmq-setup/strategies/exponential-delay.strategy';
import { createExchangeRetryName, createRoutingKeyRetryName, createDlqQueueName } from '../utils';

async function main() {
  const rabbitOptions = { url: process.env.RABBITMQ_URL ?? 'amqp://admin:admin@localhost:5672', autoConnect: false };
  const connectionService = new RabbitMQConnectionService(rabbitOptions as any);
  const extraDlq = createDlqQueueName('test.exp.queue-extra');

  const setupOptions = {
    queueSetups: [
      {
        queue: 'test.exp.queue',
        exchange: 'app.exchange.exp',
        routingKeys: ['rk.test.exp'],
        maxRetries: 5,
        delayStrategy: new ExponentialDelayStrategy(1000, 1.5, 1000 * 60, 5),
        extraDlqQueue: extraDlq,
      },
    ],
  } as any;

  const setupService = new RabbitSetupService(connectionService as any, setupOptions);

  console.info('Initializing exponential strategy setup...');
  await setupService.onModuleInit();

  const channel = connectionService.getChannel();

  // Consumer on main queue that simulates a processing failure and forwards message to retry exchange
  await channel.consume('test.exp.queue', async (msg) => {
    if (!msg) return;
    const body = msg.content.toString();
    console.info('[main.exp.consumer] received message:', body, 'headers:', msg.properties.headers);

    // simulate failure -> forward to retry exchange with x-first-death-queue header
    const exchangeRetry = createExchangeRetryName('app.exchange.exp');
    const routingKeyRetry = createRoutingKeyRetryName('test.exp.queue');

    console.info('[main.exp.consumer] forwarding to retry exchange:', exchangeRetry, 'routingKey:', routingKeyRetry);

    channel.nack(msg, false, false);
  });

  // Consumer on final DLQ to observe when messages arrive after retries/delays
  const finalDlq = extraDlq
  await channel.consume(finalDlq, async (msg) => {
    if (!msg) return;
    const receiveAt = new Date().toISOString();
    console.info('[final.exp.dlq] received message at', receiveAt, 'body:', msg.content.toString());
    console.info('[final.exp.dlq] headers:', msg.properties.headers);
    channel.ack(msg);
  });

  // Publish a test message to the main exchange so it lands in the main queue
  const publishPayload = { id: 'exp1', text: 'exponential test message', ts: Date.now() };
  console.info('[example.exp] publishing test message to app.exchange.exp -> rk.test.exp', publishPayload);
  connectionService.publish({ exchange: 'app.exchange.exp', routingKey: 'rk.test.exp', message: publishPayload, origin: 'example.exp' });

  console.info('[example.exp] waiting to observe retry/delay flow; watch logs for final DLQ arrivals');
}

main().catch((err) => {
  console.error('Example exponential failed', err);
  process.exit(1);
});