"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rabbitmq_connection_service_1 = require("../rabbitmq-connection/rabbitmq-connection.service");
const rabbitmq_setup_service_1 = require("../rabbitmq-setup/rabbitmq-setup.service");
const fixed_interval_strategy_1 = require("../rabbitmq-setup/strategies/fixed-interval.strategy");
const utils_1 = require("../utils");
async function main() {
    var _a;
    const rabbitOptions = { url: (_a = process.env.RABBITMQ_URL) !== null && _a !== void 0 ? _a : 'amqp://admin:admin@localhost:5672', autoConnect: false };
    const connectionService = new rabbitmq_connection_service_1.RabbitMQConnectionService(rabbitOptions);
    const extraDlq = (0, utils_1.createDlqQueueName)('test.queue-extra');
    const setupOptions = {
        queueSetups: [
            {
                queue: 'test.queue',
                exchange: 'app.exchange',
                routingKeys: ['rk.test'],
                maxRetries: 3,
                delayStrategy: new fixed_interval_strategy_1.FixedIntervalDelayStrategy(3000, 3),
            },
        ],
    };
    const setupService = new rabbitmq_setup_service_1.RabbitSetupService(connectionService, setupOptions);
    console.info('Initializing setup (creating exchanges/queues and registering retry consumer)...');
    await setupService.onModuleInit();
    const channel = connectionService.getChannel();
    await channel.consume('test.queue', async (msg) => {
        if (!msg)
            return;
        const body = msg.content.toString();
        console.info('[main.consumer] received message:', body, 'headers:', msg.properties.headers);
        const exchangeRetry = (0, utils_1.createExchangeRetryName)('app.exchange');
        const routingKeyRetry = (0, utils_1.createRoutingKeyRetryName)('test.queue');
        console.info('[main.consumer] forwarding to retry exchange:', exchangeRetry, 'routingKey:', routingKeyRetry);
        channel.nack(msg, false, false);
    });
    const finalDlq = extraDlq;
    await channel.consume(finalDlq, async (msg) => {
        if (!msg)
            return;
        const receiveAt = new Date().toISOString();
        console.info('[final.dlq] received message at', receiveAt, 'body:', msg.content.toString());
        console.info('[final.dlq] headers:', msg.properties.headers);
        channel.ack(msg);
    });
    const publishPayload = { id: 'm1', text: 'test message', ts: Date.now() };
    console.info('[example] publishing test message to app.exchange -> rk.test', publishPayload);
    connectionService.publish({ exchange: 'app.exchange', routingKey: 'rk.test', message: publishPayload, origin: 'example' });
    console.info('[example] waiting to observe retry/delay flow; watch logs for final DLQ arrivals');
}
main().catch((err) => {
    console.error('Example failed', err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map