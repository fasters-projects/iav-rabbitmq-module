"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Context = exports.Payload = exports.PARAMETER_TYPE = exports.RABBITMQ_CONSUMER = void 0;
exports.RabbitMQConsumer = RabbitMQConsumer;
const common_1 = require("@nestjs/common");
exports.RABBITMQ_CONSUMER = 'RABBITMQ_CONSUMER';
exports.PARAMETER_TYPE = 'PARAMETER_TYPE';
function RabbitMQConsumer(options) {
    return (target, key, descriptor) => {
        (0, common_1.SetMetadata)(exports.RABBITMQ_CONSUMER, options)(target, key, descriptor);
        return descriptor;
    };
}
function createParameterDecorator(type) {
    return (data) => (target, key, index) => {
        const existingMetadata = key
            ? Reflect.getMetadata(exports.PARAMETER_TYPE, target.constructor, key) || {}
            : {};
        existingMetadata[index] = { type, data };
        if (key !== undefined) {
            Reflect.defineMetadata(exports.PARAMETER_TYPE, existingMetadata, target.constructor, key);
        }
    };
}
exports.Payload = createParameterDecorator('payload');
exports.Context = createParameterDecorator('context');
//# sourceMappingURL=rabbitmq-consumer.decorators.js.map