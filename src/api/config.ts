export interface TicketingConfig {
  reservationTtlMinutes: number;
  paymentSlowMs: number;
  reservationHoldMs: number;
}

export interface AuthConfig {
  jwtSecret: string;
  tokenTtlMinutes: number;
  cookieSecure: boolean;
}

export type AppConfig = TicketingConfig & AuthConfig;
