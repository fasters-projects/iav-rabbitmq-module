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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMQConsumerProvider = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const rabbitmq_consumer_decorators_1 = require("./rabbitmq-consumer.decorators");
const rabbitmq_connection_service_1 = require("src/rabbitmq-connection/rabbitmq-connection.service");
let RabbitMQConsumerProvider = class RabbitMQConsumerProvider {
    constructor(discoveryService, connectionService) {
        this.discoveryService = discoveryService;
        this.connectionService = connectionService;
        this.reflector = new core_1.Reflector();
    }
    async onModuleInit() {
        await this.connectionService.connect();
        this.channel = this.connectionService.getChannel();
        this.setupConsumers();
    }
    async setupConsumers() {
        const providers = this.discoveryService.getProviders();
        const controllers = this.discoveryService.getControllers();
        await this.processProviders(providers);
        await this.processProviders(controllers);
    }
    async processProviders(wrappers) {
        for (const wrapper of wrappers) {
            const { instance } = wrapper;
            if (!instance)
                continue;
            await this.processInstance(instance);
        }
    }
    async processInstance(instance) {
        const prototype = Object.getPrototypeOf(instance);
        if (!prototype)
            return;
        const methodNames = this.getMethodNames(prototype);
        for (const methodName of methodNames) {
            await this.setupConsumerIfApplicable(instance, methodName);
        }
    }
    getMethodNames(prototype) {
        const properties = new Set();
        let currentPrototype = prototype;
        while (currentPrototype && currentPrototype !== Object.prototype) {
            Object.getOwnPropertyNames(currentPrototype)
                .filter(prop => {
                const descriptor = Object.getOwnPropertyDescriptor(currentPrototype, prop);
                return prop !== 'constructor' && descriptor && typeof descriptor.value === 'function';
            })
                .forEach(prop => properties.add(prop));
            currentPrototype = Object.getPrototypeOf(currentPrototype);
        }
        return Array.from(properties);
    }
    async setupConsumerIfApplicable(instance, methodName) {
        const consumerMetadata = this.reflector.get(rabbitmq_consumer_decorators_1.RABBITMQ_CONSUMER, instance.constructor.prototype[methodName]);
        if (!consumerMetadata) {
            return;
        }
        const { queue, prefetch = 1, noAck = false } = consumerMetadata;
        const paramMetadata = Reflect.getMetadata(rabbitmq_consumer_decorators_1.PARAMETER_TYPE, instance.constructor, methodName) || {};
        await this.channel.prefetch(prefetch);
        await this.channel.consume(queue, async (msg) => {
            if (!msg)
                return;
            try {
                const context = { channel: this.channel, message: msg };
                const args = this.resolveConsumerParams(paramMetadata, msg, context);
                await instance[methodName](...args);
                if (!noAck) {
                    this.channel.ack(msg);
                }
            }
            catch (error) {
                console.error(`Erro ao processar mensagem da fila ${queue}:`, error);
                if (!noAck) {
                    this.channel.nack(msg, false, false);
                }
            }
        });
        console.log(`Consumer configurado para a fila ${queue}`);
    }
    resolveConsumerParams(paramMetadata, msg, context) {
        const params = [];
        const maxIndex = Math.max(...Object.keys(paramMetadata).map(Number), -1);
        for (let i = 0; i <= maxIndex; i++) {
            const param = paramMetadata[i];
            if (!param) {
                params.push(undefined);
                continue;
            }
            switch (param.type) {
                case 'payload':
                    try {
                        params.push(JSON.parse(msg.content.toString()));
                    }
                    catch (err) {
                        console.log('Conteúdo não é um JSON válido:', msg.content.toString());
                        params.push(msg.content.toString());
                    }
                    break;
                case 'context':
                    params.push(context);
                    break;
                default:
                    params.push(undefined);
            }
        }
        return params;
    }
};
exports.RabbitMQConsumerProvider = RabbitMQConsumerProvider;
exports.RabbitMQConsumerProvider = RabbitMQConsumerProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.DiscoveryService,
        rabbitmq_connection_service_1.RabbitMQConnectionService])
], RabbitMQConsumerProvider);
//# sourceMappingURL=rabbitmq-consumer.provider.js.map