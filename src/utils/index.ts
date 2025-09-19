export function createExchangeRetryName(exchangeName: string): string {
  return `${exchangeName}.retry`
}

export function createExchangeDelayName(exchangeName: string): string {
  return `${exchangeName}.delay`
}

export function createExchangeDlxName(exchangeName: string): string {
  return `${exchangeName}.dlx`
}

export function createRoutingKeyDelayName(queueName: string, step?: number): string {
  if (step && step > 0) return `rk.${queueName}.delay.step${step}`;
  return `rk.${queueName}.delay`;
}

export function createRoutingKeyRetryName(queueName: string): string {
  return `rk.${queueName}.retry`;
}

export function createDelayQueueName(queueName: string): string {
  return `${queueName}.delay`;
}

export function createRetryQueueName(queueName: string): string {
  return `${queueName}.retry`;
}

export function createDlqQueueName(queueName: string): string {
  return `${queueName}.dlq`;
}

export function createNumberedDelayQueueName(queueName: string, index: number): string {
  return `${queueName}.delay.step${index}`;
}

export function createRoutingKeyDlqName(queueName: string): string {
  return `rk.${queueName}.dlq`;
}