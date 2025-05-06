import { DynamicModule } from '@nestjs/common';
import { RabbitSetupOptions } from './interfaces';
export declare class RabbitmqSetupModule<Q, E, R> {
    static register<Q, E, R>(options: RabbitSetupOptions<Q, E, R>): DynamicModule;
}
