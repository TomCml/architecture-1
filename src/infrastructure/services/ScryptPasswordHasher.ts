import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { PasswordHasherInterface } from '../../domain/interfaces/PasswordHasherInterface.js';

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, n: number, r: number, p: number, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, { N: n, r, p }, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export class ScryptPasswordHasher implements PasswordHasherInterface {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt, N, R, P, KEY_LENGTH);
    return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [n, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    if (![n, r, p].every(value => Number.isInteger(value) && value > 0)) return false;
    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    if (salt.length === 0 || expected.length === 0) return false;
    try {
      const actual = await derive(password, salt, n, r, p, expected.length);
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}
