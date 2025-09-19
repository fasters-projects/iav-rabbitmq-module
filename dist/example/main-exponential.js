"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rabbitmq_connection_service_1 = require("../rabbitmq-connection/rabbitmq-connection.service");
const rabbitmq_setup_service_1 = require("../rabbitmq-setup/rabbitmq-setup.service");
const exponential_delay_strategy_1 = require("../rabbitmq-setup/strategies/exponential-delay.strategy");
const utils_1 = require("../utils");
async function main() {
    var _a;
    const rabbitOptions = { url: (_a = process.env.RABBITMQ_URL) !== null && _a !== void 0 ? _a : 'amqp://admin:admin@localhost:5672', autoConnect: false };
    const connectionService = new rabbitmq_connection_service_1.RabbitMQConnectionService(rabbitOptions);
    const extraDlq = (0, utils_1.createDlqQueueName)('test.exp.queue-extra');
    const setupOptions = {
        queueSetups: [
            {
                queue: 'test.exp.queue',
                exchange: 'app.exchange.exp',
                routingKeys: ['rk.test.exp'],
                maxRetries: 5,
                delayStrategy: new exponential_delay_strategy_1.ExponentialDelayStrategy(1000, 1.5, 1000 * 60, 5),
                extraDlqQueue: extraDlq,
            },
        ],
    };
    const setupService = new rabbitmq_setup_service_1.RabbitSetupService(connectionService, setupOptions);
    console.info('Initializing exponential strategy setup...');
    await setupService.onModuleInit();
    const channel = connectionService.getChannel();
    await channel.consume('test.exp.queue', async (msg) => {
        if (!msg)
            return;
        const body = msg.content.toString();
        console.info('[main.exp.consumer] received message:', body, 'headers:', msg.properties.headers);
        const exchangeRetry = (0, utils_1.createExchangeRetryName)('app.exchange.exp');
        const routingKeyRetry = (0, utils_1.createRoutingKeyRetryName)('test.exp.queue');
        console.info('[main.exp.consumer] forwarding to retry exchange:', exchangeRetry, 'routingKey:', routingKeyRetry);
        channel.nack(msg, false, false);
    });
    const finalDlq = extraDlq;
    await channel.consume(finalDlq, async (msg) => {
        if (!msg)
            return;
        const receiveAt = new Date().toISOString();
        console.info('[final.exp.dlq] received message at', receiveAt, 'body:', msg.content.toString());
        console.info('[final.exp.dlq] headers:', msg.properties.headers);
        channel.ack(msg);
    });
    const publishPayload = { id: 'exp1', text: 'exponential test message', ts: Date.now() };
    console.info('[example.exp] publishing test message to app.exchange.exp -> rk.test.exp', publishPayload);
    connectionService.publish({ exchange: 'app.exchange.exp', routingKey: 'rk.test.exp', message: publishPayload, origin: 'example.exp' });
    console.info('[example.exp] waiting to observe retry/delay flow; watch logs for final DLQ arrivals');
}
main().catch((err) => {
    console.error('Example exponential failed', err);
    process.exit(1);
});
//# sourceMappingURL=main-exponential.js.map