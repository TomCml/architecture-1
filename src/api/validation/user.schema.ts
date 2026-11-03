import { asRecord, stringField } from './common.schema.js';

export function parseCredentials(body: unknown): { email: string; password: string } {
  const record = asRecord(body);
  return { email: stringField(record, 'email'), password: stringField(record, 'password') };
}
