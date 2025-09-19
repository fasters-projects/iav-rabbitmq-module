"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExchangeRetryName = createExchangeRetryName;
exports.createExchangeDelayName = createExchangeDelayName;
exports.createExchangeDlxName = createExchangeDlxName;
exports.createRoutingKeyDelayName = createRoutingKeyDelayName;
exports.createRoutingKeyRetryName = createRoutingKeyRetryName;
exports.createDelayQueueName = createDelayQueueName;
exports.createRetryQueueName = createRetryQueueName;
exports.createDlqQueueName = createDlqQueueName;
exports.createNumberedDelayQueueName = createNumberedDelayQueueName;
exports.createRoutingKeyDlqName = createRoutingKeyDlqName;
function createExchangeRetryName(exchangeName) {
    return `${exchangeName}.retry`;
}
function createExchangeDelayName(exchangeName) {
    return `${exchangeName}.delay`;
}
function createExchangeDlxName(exchangeName) {
    return `${exchangeName}.dlx`;
}
function createRoutingKeyDelayName(queueName, step) {
    if (step && step > 0)
        return `rk.${queueName}.delay.step${step}`;
    return `rk.${queueName}.delay`;
}
function createRoutingKeyRetryName(queueName) {
    return `rk.${queueName}.retry`;
}
function createDelayQueueName(queueName) {
    return `${queueName}.delay`;
}
function createRetryQueueName(queueName) {
    return `${queueName}.retry`;
}
function createDlqQueueName(queueName) {
    return `${queueName}.dlq`;
}
function createNumberedDelayQueueName(queueName, index) {
    return `${queueName}.delay.step${index}`;
}
function createRoutingKeyDlqName(queueName) {
    return `rk.${queueName}.dlq`;
}
//# sourceMappingURL=index.js.map