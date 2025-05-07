
# iav-rabbitmq-module

O `iav-rabbitmq-module` é um módulo para facilitar a integração com o RabbitMQ em aplicações NestJS. Ele fornece funcionalidades para configurar filas, exchanges, bindings, consumidores e publicadores de mensagens.

---

## Instalação

Certifique-se de instalar o pacote no seu projeto, no `package.json` adicione a dependência (enquanto não houver um módulo npm pra ele):

```json
"dependencies": {
  ...
  "iav-rabbitmq-module": "git+ssh://git@github.com:fasters-projects/iav-rabbitmq-module.git",
  ...
}
```

---

## Módulos Disponíveis

1. **RabbitMQConnectionModule**: Gerencia a conexão com o RabbitMQ.
2. **RabbitmqConsumerModule**: Configura consumidores para processar mensagens.
3. **RabbitmqSetupModule**: Configura filas, exchanges e bindings.
4. **Utils**: Fornece funções utilitárias para criar nomes de filas, exchanges e routing keys.

---

## Exemplo de Uso

### Configuração do Setup (Filas, Exchanges e Bindings)

```typescript
import { Module } from '@nestjs/common';
import { RabbitMQConnectionModule, RabbitmqConsumerModule, RabbitmqSetupModule } from 'iav-rabbitmq-module';
import { Exchanges, Queues, RoutingKeys } from './config/rabbitmq/config';

const queueConfigurations = [
  {
    queue: Queues.NOTIFICATION,
    exchange: Exchanges.NOTIFICATION,
    routingKeys: [RoutingKeys.SEND_NOTIFICATION],
  },
];

@Module({
  imports: [
    RabbitmqSetupModule.register<Queues, Exchanges, RoutingKeys>({
      queueSetups: queueConfigurations,
    }),
    RabbitMQConnectionModule.register({
      url: process.env.RABBITMQ_URL || 'amqp://localhost',
    }),
    RabbitmqConsumerModule,
    NotificationModule,
  ],
})
export class AppModule {}
```

---

### Consumidor de Mensagens

```typescript
import { Controller } from '@nestjs/common';
import { Context, Payload, RabbitMQConsumer, MessageConsumerContext } from 'iav-rabbitmq-module';

export class NotificationMessage {
  recipient: string;
  title: string;
  body: string;
}

@Controller()
export class NotificationConsumer {
  @RabbitMQConsumer({ queue: Queues.NOTIFICATION, prefetch: 5 })
  async handleNotification(@Payload() message: NotificationMessage, @Context() context: MessageConsumerContext) {
    try {
      console.log('Mensagem recebida:', message);
      // Processa a mensagem recebida
    } catch (error) {
      console.error('Erro ao processar a mensagem:', error);
      throw error;
    }
  }
}
```

---

### Publicador de Mensagens

```typescript
import { Injectable } from '@nestjs/common';
import { RabbitMQConnectionService } from 'iav-rabbitmq-module';

@Injectable()
export class NotificationPublisher {
  constructor(private readonly rabbitmqConnectionService: RabbitMQConnectionService) {}

  async publishNotification() {
    const message = {
      recipient: 'user@example.com',
      title: 'Nova Notificação',
      body: 'Você tem uma nova mensagem.',
    };

    try {
      await this.rabbitmqConnectionService.publish({
        exchange: Exchanges.NOTIFICATION,
        routingKey: RoutingKeys.SEND_NOTIFICATION,
        message,
        origin: 'NOTIFICATION-SERVICE',
      });
      console.log('Mensagem publicada com sucesso:', message);
    } catch (error) {
      console.error('Erro ao publicar a mensagem:', error);
    }
  }
}
```

---

## Funcionamento do Setup

O `RabbitmqSetupModule` é responsável por configurar automaticamente as filas, exchanges e bindings no RabbitMQ com base nas configurações fornecidas.

### Passos:

1. **Criação de Exchanges**:
   - Exchanges principais, de retry, delay e DLX (Dead Letter Exchange) são criadas.
   - Nomes são gerados dinamicamente usando os utilitários, como `createExchangeRetryName` e `createExchangeDelayName`.

2. **Criação de Filas**:
   - Filas principais, de retry, delay e DLQ (Dead Letter Queue) são criadas.
   - As filas são configuradas com propriedades como `durable`, `autoDelete` e argumentos específicos (`x-dead-letter-exchange`, `x-message-ttl`, etc.).

3. **Bindings**:
   - As filas são vinculadas às exchanges apropriadas com as routing keys fornecidas.

---

## Nomenclatura

A nomenclatura das filas, exchanges e routing keys segue um padrão para facilitar a organização e o entendimento:

- **Exchanges**:
  - `exchangeName`: Exchange principal.
  - `exchangeName.retry`: Exchange para mensagens em retry.
  - `exchangeName.delay`: Exchange para mensagens em delay.
  - `exchangeName.dlx`: Dead Letter Exchange.

- **Filas**:
  - `queueName`: Fila principal.
  - `queueName.retry`: Fila para mensagens em retry.
  - `queueName.delay`: Fila para mensagens em delay.
  - `queueName.dlq`: Dead Letter Queue.

- **Routing Keys**:
  - `rk.queueName.delay`: Routing key para mensagens em delay.
  - `rk.queueName.retry`: Routing key para mensagens em retry.

---

## Utilitários Disponíveis

Os utilitários ajudam a criar nomes consistentes para filas, exchanges e routing keys:

```typescript
import { createExchangeRetryName, createDlqQueueName } from 'iav-rabbitmq-module';

const retryExchange = createExchangeRetryName('notification');
const dlqQueue = createDlqQueueName('notification');

console.log(retryExchange); // notification.retry
console.log(dlqQueue); // notification.dlq
```

---

## Conclusão

Com o `iav-rabbitmq-module`, você pode configurar e gerenciar filas, exchanges e consumidores de forma simples e eficiente, seguindo