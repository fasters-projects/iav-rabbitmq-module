"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var RabbitmqSetupModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitmqSetupModule = void 0;
const common_1 = require("@nestjs/common");
const rabbitmq_setup_service_1 = require("./rabbitmq-setup.service");
const rabbitmq_connection_module_1 = require("../rabbitmq-connection/rabbitmq-connection.module");
let RabbitmqSetupModule = RabbitmqSetupModule_1 = class RabbitmqSetupModule {
    static register(options) {
        return {
            module: RabbitmqSetupModule_1,
            imports: [rabbitmq_connection_module_1.RabbitMQConnectionModule],
            providers: [
                {
                    provide: 'RABBIT_SETUP_OPTIONS',
                    useValue: options,
                },
                rabbitmq_setup_service_1.RabbitSetupService,
            ],
            exports: [rabbitmq_setup_service_1.RabbitSetupService],
        };
    }
};
exports.RabbitmqSetupModule = RabbitmqSetupModule;
exports.RabbitmqSetupModule = RabbitmqSetupModule = RabbitmqSetupModule_1 = __decorate([
    (0, common_1.Module)({
        exports: [rabbitmq_setup_service_1.RabbitSetupService],
        providers: [rabbitmq_setup_service_1.RabbitSetupService],
        imports: [rabbitmq_connection_module_1.RabbitMQConnectionModule]
    })
], RabbitmqSetupModule);
//# sourceMappingURL=rabbitmq-setup.module.js.map