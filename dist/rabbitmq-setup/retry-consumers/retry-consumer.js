"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryConsumer = retryConsumer;
const rabbitmq_connection_service_1 = require("../../rabbitmq-connection/rabbitmq-connection.service");
const utils_1 = require("../../utils");
function retryConsumer(channel, retryQueueName, opts, strategy) {
    channel.consume(retryQueueName, async (message) => {
        if (!message)
            return;
        const headers = (message.properties.headers || {});
        try {
            const originQueue = headers[rabbitmq_connection_service_1.CustomHeaderNames.LastDeathQueue] || headers['x-origin-queue'];
            const currentCount = headers[rabbitmq_connection_service_1.CustomHeaderNames.RetryCount]
                ? parseInt(headers[rabbitmq_connection_service_1.CustomHeaderNames.RetryCount], 10)
                : 0;
            if (!originQueue) {
                console.log(`[rabbitmq-retry-consumer] No origin queue found in message headers. retry queue: ${retryQueueName}`);
                channel.nack(message, false, false);
                return;
            }
            console.log(`[rabbitmq-retry-consumer] Message to queue ${originQueue} count: ${currentCount}, maxRetries: ${opts.maxRetries}.`);
            if (currentCount >= opts.maxRetries) {
                console.log(`[rabbitmq-retry-consumer] Message to queue ${originQueue} has reached the maximum number of retries (${opts.maxRetries}).`);
                channel.nack(message, false, false);
                return;
            }
            const nextCount = currentCount + 1;
            headers[rabbitmq_connection_service_1.CustomHeaderNames.RetryCount] = String(nextCount);
            const decision = strategy.decide(String(originQueue), nextCount, opts.maxRetries);
            if (!decision) {
                console.log(`[rabbitmq-retry-consumer] Message to queue ${originQueue} has reached the maximum number of retries (${opts.maxRetries}).`);
                channel.nack(message, false, false);
                return;
            }
            const expiration = decision.expirationMs ? String(decision.expirationMs) : undefined;
            if (decision.routingKey && opts.exchangeDelay) {
                console.log(`[rabbitmq-retry-consumer] Message to queue ${originQueue} will be sent to routing key ${decision.routingKey}.`);
                channel.publish(opts.exchangeDelay, decision.routingKey, message.content, { headers, expiration });
                channel.ack(message);
                return;
            }
            if (decision.step && opts.exchangeDelay) {
                const rk = (0, utils_1.createRoutingKeyDelayName)(String(originQueue), decision.step);
                console.log(`[rabbitmq-retry-consumer] Message to queue ${originQueue} will be sent to routing key ${rk}. Step: ${decision.step}.`);
                channel.publish(opts.exchangeDelay, rk, message.content, { headers, expiration });
                channel.ack(message);
                return;
            }
            if (decision.targetDelayQueue) {
                console.log(`[rabbitmq-retry-consumer] Message to queue ${originQueue} will be sent to queue ${decision.targetDelayQueue}.`);
                channel.sendToQueue(String(decision.targetDelayQueue), message.content, { headers, expiration });
                channel.ack(message);
                return;
            }
            console.log(`[rabbitmq-retry-consumer] Message to queue ${originQueue} didn't match any retry strategy.`);
            channel.nack(message, false, false);
        }
        catch (err) {
            headers[rabbitmq_connection_service_1.CustomHeaderNames.LastError] = String(err);
            channel.nack(message, false, false);
        }
    });
}
//# sourceMappingURL=retry-consumer.js.map