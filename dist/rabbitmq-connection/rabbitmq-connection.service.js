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
exports.RabbitMQConnectionService = exports.CustomHeaderNames = exports.RABBITMQ_OPTIONS = void 0;
const common_1 = require("@nestjs/common");
const amqplib_1 = require("amqplib");
exports.RABBITMQ_OPTIONS = 'RABBITMQ_OPTIONS';
var CustomHeaderNames;
(function (CustomHeaderNames) {
    CustomHeaderNames["FirstDeathQueue"] = "x-first-death-queue";
    CustomHeaderNames["LastDeathQueue"] = "x-last-death-queue";
    CustomHeaderNames["RetryCount"] = "x-retry-count";
    CustomHeaderNames["LastError"] = "x-last-error";
    CustomHeaderNames["ApplicationSource"] = "x-application-source";
})(CustomHeaderNames || (exports.CustomHeaderNames = CustomHeaderNames = {}));
const baseDelay = 2000;
const maxDelay = 600000;
let RabbitMQConnectionService = class RabbitMQConnectionService {
    constructor(options) {
        this.options = options;
        this.reconnectAttempts = 0;
        this.consumers = [];
        this.proxyChannel = new Proxy({}, {
            get: (_, prop) => {
                if (!this.channel) {
                    throw new Error('Channel not available (disconnected)');
                }
                const value = this.channel[prop];
                return typeof value === 'function' ? value.bind(this.channel) : value;
            },
        });
    }
    async onModuleInit() {
        if (this.options.autoConnect === true)
            await this.connect();
    }
    async connect() {
        if (!this.connection) {
            console.log("Connecting to rabbitmq...");
            this.connection = await (0, amqplib_1.connect)(this.options.url);
            this.channel = await this.connection.createConfirmChannel();
            const originalConsume = this.channel.consume.bind(this.channel);
            this.channel.consume = async (queue, onMessage, options) => {
                this.consumers.push({ queue, onMessage, options });
                return originalConsume(queue, onMessage, options);
            };
            this.connection.on("error", (err) => {
                console.error("Erro na conexão RabbitMQ:", err.message);
            });
            this.connection.on("close", () => {
                console.warn("Conexão RabbitMQ fechada, tentando reconectar...");
                this.reconnect();
            });
            console.log("Connected to rabbitmq");
            if (this.consumers.length > 0) {
                console.log("Registrando consumidores novamente...");
                for (const c of this.consumers) {
                    console.log("Registrando consumidor:", c.queue);
                    await originalConsume(c.queue, c.onMessage, c.options);
                }
            }
        }
        return this.connection;
    }
    async reconnect() {
        this.connection = null;
        this.channel = null;
        this.reconnectAttempts++;
        const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), maxDelay);
        console.log(`Tentando reconectar em ${delay / 1000}s... (tentativa ${this.reconnectAttempts})`);
        setTimeout(async () => {
            try {
                await this.connect();
                this.reconnectAttempts = 0;
            }
            catch (err) {
                console.error("Erro inesperado ao tentar reconectar:", err.message);
                this.reconnect();
            }
        }, delay);
    }
    getChannel() {
        if (this.proxyChannel === undefined || this.channel === undefined)
            throw new Error('RabbitMQ connection failed!');
        return this.proxyChannel;
    }
    publish(publishOptions) {
        if (this.channel === undefined)
            throw new Error('RabbitMQ not connected!');
        return this.channel.publish(publishOptions.exchange, publishOptions.routingKey, Buffer.from(JSON.stringify(publishOptions.message)), {
            headers: {
                'x-application-origin': publishOptions.origin,
            }
        });
    }
    async onModuleDestroy() {
        var _a, _b;
        await ((_a = this.channel) === null || _a === void 0 ? void 0 : _a.close());
        await ((_b = this.connection) === null || _b === void 0 ? void 0 : _b.close());
    }
};
exports.RabbitMQConnectionService = RabbitMQConnectionService;
exports.RabbitMQConnectionService = RabbitMQConnectionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(exports.RABBITMQ_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], RabbitMQConnectionService);
//# sourceMappingURL=rabbitmq-connection.service.js.map