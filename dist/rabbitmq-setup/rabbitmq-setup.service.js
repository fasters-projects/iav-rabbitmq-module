"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitSetupService = void 0;
const common_1 = require("@nestjs/common");
const rabbitmq_connection_service_1 = require("../rabbitmq-connection/rabbitmq-connection.service");
const utils_1 = require("../utils");
const retry_consumer_1 = require("./retry-consumers/retry-consumer");
const fixed_interval_strategy_1 = require("./strategies/fixed-interval.strategy");
const DEFAULT_ROUTING_KEY = '';
const DEFAULT_DELAY_TIME = 60000 * 10 * 1;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_QUEUE_TYPE = 'quorum';
let RabbitSetupService = class RabbitSetupService {
    constructor(connectionService, options) {
        this.connectionService = connectionService;
        this.options = options;
        this.createdExchanges = new Set();
        this.queueOptions = {};
    }
    async onModuleInit() {
        this.connection = await this.connectionService.connect();
        this.channel = this.connectionService.getChannel();
        this.channel.on('error', async (error) => {
            console.log("channel error: ", error);
        });
        const queueSetups = this.options.queueSetups;
        for (const queueSetup of queueSetups) {
            await this.setupQueue(queueSetup);
        }
    }
    async createExchange(exchangeName, exchangeType = 'topic') {
        if (this.channel === undefined)
            throw new Error('RabbitMQ connection failed!');
        const exchangeOptions = {
            durable: true,
            autoDelete: false,
        };
        try {
            await this.channel.assertExchange(exchangeName, exchangeType, exchangeOptions);
        }
        catch (e) {
            if (process.env.NODE_ENV === 'dev') {
                await this.channel.deleteExchange(exchangeName);
                await this.channel.assertExchange(exchangeName, exchangeType, exchangeOptions);
            }
            else {
                console.error(`Error asserting exchange ${exchangeName}`, e);
                throw e;
            }
        }
    }
    async createDeadLetterQueue(queueName, deadLetterExchange) {
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
    async createDelayQueue(queueName, deadLetterExchange, deadLetterRoutingkey = DEFAULT_ROUTING_KEY) {
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
    async bindQueue(exchange, queueName, routingKey = DEFAULT_ROUTING_KEY) {
        await this.channel.bindQueue(queueName, exchange, routingKey);
    }
    async createQueue(queueName, deadLetterExchange, deadLetterRoutingkey = DEFAULT_ROUTING_KEY) {
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
    async assertQueue(queueName, queueOptions) {
        try {
            await this.channel.assertQueue(queueName, queueOptions);
            console.info(`Queue "${queueName}" created successfully.`);
        }
        catch (error) {
            if (process.env.NODE_ENV === 'dev' && (error === null || error === void 0 ? void 0 : error.code) === 406) {
                console.warn(`Queue "${queueName}" already exists with different arguments. Deleting and recreating it.`);
                const channel = await this.connection.createChannel();
                await channel.deleteQueue(queueName, { ifUnused: false });
                await channel.close();
                await this.onModuleInit();
            }
            else {
                console.error(`Error creating queue "${queueName}":`, error);
                throw error;
            }
        }
    }
    async closeConnection() {
        await this.channel.close();
    }
    async setupQueue({ exchange, maxRetries = DEFAULT_MAX_RETRIES, queue, routingKeys, extraDlqQueue, delayTime, delayStrategy }) {
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
        if (extraDlqQueue)
            await this.createExtraDlqQueue(extraDlqQueue, exchange, queue);
    }
    async setupExchangesWithRetryDlqAndDelay(exchange) {
        if (!this.createdExchanges.has(exchange)) {
            this.createdExchanges.add(exchange);
            const exchangeRetry = (0, utils_1.createExchangeRetryName)(exchange);
            const exchangeDelay = (0, utils_1.createExchangeDelayName)(exchange);
            const exchangeDlx = (0, utils_1.createExchangeDlxName)(exchange);
            await this.createExchange(exchange, 'topic');
            await this.createExchange(exchangeRetry, 'topic');
            await this.createExchange(exchangeDelay, 'topic');
            await this.createExchange(exchangeDlx, 'topic');
        }
    }
    async setupQueuesWithRetryAndDelay({ exchange, queue, routingKeys, delayTime = DEFAULT_DELAY_TIME, delayStrategy, }) {
        var _a, _b;
        const retryRoutingKey = (0, utils_1.createRoutingKeyRetryName)(queue);
        const dlqRoutingKey = (0, utils_1.createRoutingKeyDlqName)(queue);
        const exchangeRetry = (0, utils_1.createExchangeRetryName)(exchange);
        const exchangeDelay = (0, utils_1.createExchangeDelayName)(exchange);
        const exchangeDlx = (0, utils_1.createExchangeDlxName)(exchange);
        const queueRetry = (0, utils_1.createRetryQueueName)(queue);
        const queueDlq = (0, utils_1.createDlqQueueName)(queue);
        await this.createQueue(queue, exchangeRetry, retryRoutingKey);
        for (const key of routingKeys) {
            await this.bindQueue(exchange, queue, key);
        }
        const mainRoutingKey = routingKeys && routingKeys.length ? routingKeys[0] : DEFAULT_ROUTING_KEY;
        const maxRetries = (_b = (_a = this.queueOptions[queue]) === null || _a === void 0 ? void 0 : _a.maxRetries) !== null && _b !== void 0 ? _b : DEFAULT_MAX_RETRIES;
        for (let step = 1; step <= maxRetries; step++) {
            const numberedDelayQueue = (0, utils_1.createNumberedDelayQueueName)(queue, step);
            await this.createDelayQueue(numberedDelayQueue, exchange, mainRoutingKey);
            const routingKeyForStep = (0, utils_1.createRoutingKeyDelayName)(queue, step);
            await this.bindQueue(exchangeDelay, numberedDelayQueue, routingKeyForStep);
        }
        await this.createQueue(queueRetry, exchangeDlx, dlqRoutingKey);
        await this.createQueue(queueDlq, '');
        await this.bindQueue(exchangeRetry, queueRetry, retryRoutingKey);
        await this.bindQueue(exchangeDlx, queueDlq, dlqRoutingKey);
        await this.createRetryConsumer({
            exchange,
            delayStrategy,
            delayTime,
            queue,
        });
    }
    createRetryConsumer({ exchange, delayStrategy, delayTime, queue, }) {
        var _a, _b, _c, _d;
        const exchangeDelay = (0, utils_1.createExchangeDelayName)(exchange);
        const queueRetry = (0, utils_1.createRetryQueueName)(queue);
        const retryConsumerOptions = {
            exchangeDelay,
            maxRetries: (_b = (_a = this.queueOptions[queue]) === null || _a === void 0 ? void 0 : _a.maxRetries) !== null && _b !== void 0 ? _b : DEFAULT_MAX_RETRIES,
            defaultDelayMs: delayTime,
        };
        const strategy = delayStrategy !== null && delayStrategy !== void 0 ? delayStrategy : new fixed_interval_strategy_1.FixedIntervalDelayStrategy(delayTime, (_d = (_c = this.queueOptions[queue]) === null || _c === void 0 ? void 0 : _c.maxRetries) !== null && _d !== void 0 ? _d : DEFAULT_MAX_RETRIES);
        (0, retry_consumer_1.retryConsumer)(this.channel, queueRetry, retryConsumerOptions, strategy);
    }
    async createExtraDlqQueue(queue, exchange, originalQueue) {
        const exchangeDlxName = (0, utils_1.createExchangeDlxName)(exchange);
        const routingKey = (0, utils_1.createRoutingKeyDlqName)(originalQueue);
        await this.createDeadLetterQueue(queue, '');
        await this.bindQueue(exchangeDlxName, queue, routingKey);
    }
};
exports.RabbitSetupService = RabbitSetupService;
exports.RabbitSetupService = RabbitSetupService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)('RABBIT_SETUP_OPTIONS')),
    __metadata("design:paramtypes", [rabbitmq_connection_service_1.RabbitMQConnectionService, Object])
], RabbitSetupService);
//# sourceMappingURL=rabbitmq-setup.service.js.map