"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var RabbitMQConnectionModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMQConnectionModule = void 0;
const common_1 = require("@nestjs/common");
const rabbitmq_connection_service_1 = require("./rabbitmq-connection.service");
let RabbitMQConnectionModule = RabbitMQConnectionModule_1 = class RabbitMQConnectionModule {
    static register(options) {
        return {
            module: RabbitMQConnectionModule_1,
            providers: [
                {
                    provide: rabbitmq_connection_service_1.RABBITMQ_OPTIONS,
                    useValue: options,
                },
                rabbitmq_connection_service_1.RabbitMQConnectionService,
            ],
            exports: [rabbitmq_connection_service_1.RabbitMQConnectionService],
        };
    }
};
exports.RabbitMQConnectionModule = RabbitMQConnectionModule;
exports.RabbitMQConnectionModule = RabbitMQConnectionModule = RabbitMQConnectionModule_1 = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({})
], RabbitMQConnectionModule);
//# sourceMappingURL=rabbitmq-connection.module.js.map