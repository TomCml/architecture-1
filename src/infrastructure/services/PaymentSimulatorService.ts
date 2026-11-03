import { setTimeout as sleep } from 'node:timers/promises';
import type { PaymentGatewayInterface } from '../../domain/interfaces/PaymentGatewayInterface.js';
import type { PaymentScenario, PaymentStatus } from '../../domain/types.js';

export class PaymentSimulatorService implements PaymentGatewayInterface {
  constructor(private readonly slowMs: number) {}

  async run(scenario: PaymentScenario): Promise<PaymentStatus> {
    if (scenario === 'slow') {
      await sleep(this.slowMs);
      return 'PENDING';
    }
    return scenario === 'success' ? 'SUCCEEDED' : 'FAILED';
  }
}
