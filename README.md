
# iav-rabbitmq-module

O `iav-rabbitmq-module` é um módulo para facilitar a integração com o RabbitMQ em aplicações NestJS. Ele fornece funcionalidades para configurar filas, exchanges, bindings, consumidores e publicadores de mensagens.

Importante: a biblioteca implementa auto-reconexão e auto-registro de consumidores. Se a conexão com o RabbitMQ cair, o módulo tentará reconectar periodicamente (com backoff exponencial). Após a reconexão bem-sucedida, os consumidores previamente registrados são registrados automaticamente novamente.

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
      autoConnect: true, //Para conectar no OnModuleInit
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

## Estratégias de Delay

O módulo suporta estratégias de delay (implementações da interface `DelayStrategy`) que decidem para qual fila de delay uma mensagem deve ser enviada quando falha o processamento.

- FixedInterval (padrão): aplica um intervalo fixo entre tentativas. Se nenhuma estratégia for informada para uma fila, o módulo utiliza internamente a `FixedIntervalDelayStrategy` (defaults: 1s de intervalo e 5 níveis).
- ExponentialDelay: aplica um atraso que cresce exponencialmente até um cap configurado.

As estratégias implementam a interface `DelayStrategy` que retorna um `DelayDecision` contendo campos como:

- `targetDelayQueue?`: fila de delay alvo (se omitido, a mensagem vai direto para a DLQ final).
- `expirationMs?`: tempo em ms para definir no header `expiration` da mensagem.
- `step?`: número do passo (1-based) do delay.
- `routingKey?`: routing key a ser usada no exchange de delay.
- `canRetry`: indica se a mensagem ainda pode ser re-tentada.

Exemplo de configuração por fila (pseudocódigo):

```ts
{
  queue: Queues.NOTIFICATION,
  exchange: Exchanges.NOTIFICATION,
  routingKeys: [RoutingKeys.SEND_NOTIFICATION],
  maxRetries: 5,
  delayStrategy: new ExponentialDelayStrategy(1000, 2, 30 * 60 * 1000, 5),
}
```

## extraDlqQueue

Ao configurar uma fila no `RabbitmqSetupModule` é possível passar a propriedade `extraDlqQueue` no `QueueBindConfig`:

- `extraDlqQueue`: nome de uma fila adicional que será ligada ao exchange DLX da aplicação. Ela permite consumir mensagens que chegaram à DLQ (Dead Letter Queue) principal, mas mantendo a DLQ principal intacta.

Uso exemplo:

```ts
{
  queue: Queues.NOTIFICATION,
  exchange: Exchanges.NOTIFICATION,
  routingKeys: [RoutingKeys.SEND_NOTIFICATION],
  extraDlqQueue: Queues.NOTIFICATION_EXTRA_DLQ // Será criada e ligada ao <exchange>.dlx com a routing key `rk.<queue>.dlq`
}
```

Quando `extraDlqQueue` é informado, o módulo cria essa fila (durable) e a liga ao exchange `<exchange>.dlx` usando a routing key `rk.<queue>.dlq`. Isso permite consumir mensagens que foram para DLQ sem remover a DLQ principal do fluxo.

## Convenções de nomes e flags de delay

O módulo usa utilitários para gerar nomes consistentes. Principais funções e seus resultados:

- `createExchangeRetryName(exchange)` -> `${exchange}.retry`
- `createExchangeDelayName(exchange)` -> `${exchange}.delay`
- `createExchangeDlxName(exchange)` -> `${exchange}.dlx`

- `createRetryQueueName(queue)` -> `${queue}.retry`
- `createDelayQueueName(queue)` -> `${queue}.delay`
- `createNumberedDelayQueueName(queue, step)` -> `${queue}.delay.step${step}` (usado para gerar as filas de delay por nível)
- `createDlqQueueName(queue)` -> `${queue}.dlq`

- `createRoutingKeyDelayName(queue, step?)` -> `rk.${queue}.delay` ou `rk.${queue}.delay.step${step}`
- `createRoutingKeyRetryName(queue)` -> `rk.${queue}.retry`
- `createRoutingKeyDlqName(queue)` -> `rk.${queue}.dlq`

Flags/arguments relevantes para filas criadas pelo módulo:

- `x-dead-letter-exchange`: exchange de dead-letter configurado para filas principais e de delay.
- `x-dead-letter-routing-key`: routing key usada para encaminhar mensagens para DLX.
- `x-max-retries`: definido nas filas de delay para indicar o máximo de tentativas (usado internamente pelo consumidor de retry).

Observação: o módulo gera automaticamente filas de delay numeradas (step1..stepN) com base em `maxRetries`. Cada fila de delay é criada com `x-dead-letter-exchange` apontando para o exchange principal e `x-dead-letter-routing-key` para a routing key principal da fila; após a expiração a mensagem volta ao fluxo apropriado.

## Exemplos praticos de Retry com diferentes estratégias de delay

Para executar o exemplo de estratégia de delay com tempo fixo:

```sh
npx ts-node -r tsconfig-paths/register ./src/example/main.ts
```

Para executar o exemplo de estratégia de delay com delay exponencial:

```sh
npx ts-node -r tsconfig-paths/register ./src/example/main-exponential.ts
```