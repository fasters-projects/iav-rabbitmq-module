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
const rabbitmq_connection_service_1 = require("src/rabbitmq-connection/rabbitmq-connection.service");
const utils_1 = require("src/utils");
const DEFAULT_ROUTING_KEY = '';
const DEFAULT_DELAY_TIME = 1000 * 60 * 1;
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
    async createDelayQueue(queueName, deadLetterExchange, delayTime = DEFAULT_DELAY_TIME, deadLetterRoutingkey = DEFAULT_ROUTING_KEY) {
        const maxRetries = 5;
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
    async createRetryQueueConsumer(retryQueueName) {
        this.channel.consume(retryQueueName, async (message) => {
            var _a;
            if (!message) {
                console.info("Message doesn't exist. Queue: ", retryQueueName);
                return;
            }
            const headers = message.properties.headers || {};
            try {
                const originQueue = headers[rabbitmq_connection_service_1.CustomHeaderNames.FirstDeathQueue];
                const currentCount = headers[rabbitmq_connection_service_1.CustomHeaderNames.RetryCount]
                    ? parseInt(headers[rabbitmq_connection_service_1.CustomHeaderNames.RetryCount], 10)
                    : 1;
                const maxRetries = ((_a = this.queueOptions[originQueue]) === null || _a === void 0 ? void 0 : _a.maxRetries) || 0;
                if (currentCount > maxRetries + 1) {
                    console.warn(`Max retryes reached: ${originQueue}, sending to DLQ. message: ${message.content.toString()}`);
                    this.channel.nack(message, false, false);
                    return;
                }
                headers[rabbitmq_connection_service_1.CustomHeaderNames.RetryCount] = currentCount + 1;
                console.info(`Resending Message to queue ${originQueue}: Message :${message.content.toString()}`);
                this.channel.sendToQueue(originQueue, message.content, {
                    headers: headers,
                });
                this.channel.ack(message);
            }
            catch (error) {
                console.info(`ErrorIn Queue: ${retryQueueName}, sending to DLQ`);
                headers[rabbitmq_connection_service_1.CustomHeaderNames.LastError] = error;
                this.channel.nack(message, false, false);
            }
        });
    }
    async closeConnection() {
        await this.channel.close();
    }
    async setupQueue({ delayTime = DEFAULT_DELAY_TIME, exchange, maxRetries = DEFAULT_MAX_RETRIES, queue, routingKeys, }) {
        this.queueOptions[queue] = {
            maxRetries,
        };
        await this.setupExchangesWithRetryDlqAndDelay(exchange);
        await this.setupQueuesWithRetryAndDelay({
            queue,
            exchange,
            routingKeys,
            delayTime,
        });
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
    async setupQueuesWithRetryAndDelay({ delayTime, exchange, queue, routingKeys, }) {
        const delayDlqRoutingKey = (0, utils_1.createRoutingKeyDelayName)(queue);
        const retryDlqRoutingKey = (0, utils_1.createRoutingKeyRetryName)(queue);
        ;
        const exchangeRetry = (0, utils_1.createExchangeRetryName)(exchange);
        const exchangeDelay = (0, utils_1.createExchangeDelayName)(exchange);
        const exchangeDlx = (0, utils_1.createExchangeDlxName)(exchange);
        const queueDelay = (0, utils_1.createDelayQueueName)(queue);
        const queueRetry = (0, utils_1.createRetryQueueName)(queue);
        const queueDlq = (0, utils_1.createDlqQueueName)(queue);
        await this.createQueue(queue, exchangeDelay, delayDlqRoutingKey);
        for (const key of routingKeys) {
            await this.bindQueue(exchange, queue, key);
        }
        await this.createDelayQueue(queueDelay, exchangeRetry, delayTime, retryDlqRoutingKey);
        await this.createDeadLetterQueue(queueRetry, exchangeDlx);
        await this.createDeadLetterQueue(queueDlq, '');
        await this.bindQueue(exchangeRetry, queueRetry, retryDlqRoutingKey);
        await this.bindQueue(exchangeDelay, queueDelay, delayDlqRoutingKey);
        await this.bindQueue(exchangeDlx, queueDlq);
        await this.createRetryQueueConsumer(queueRetry);
    }
};
exports.RabbitSetupService = RabbitSetupService;
exports.RabbitSetupService = RabbitSetupService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)('RABBIT_SETUP_OPTIONS')),
    __metadata("design:paramtypes", [rabbitmq_connection_service_1.RabbitMQConnectionService, Object])
], RabbitSetupService);
//# sourceMappingURL=rabbitmq-setup.service.js.map