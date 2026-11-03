import type { PaymentScenario, PaymentStatus } from '../types.js';

export interface PaymentGatewayInterface {
  run(scenario: PaymentScenario): Promise<PaymentStatus>;
}
