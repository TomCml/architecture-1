import { jwtVerify, SignJWT } from 'jose';
import type { TokenServiceInterface } from '../../domain/interfaces/TokenServiceInterface.js';

export class JoseTokenService implements TokenServiceInterface {
  private readonly key: Uint8Array;

  constructor(secret: string, private readonly ttlMinutes: number) {
    this.key = new TextEncoder().encode(secret);
  }

  async sign(userId: string): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(`${Math.round(this.ttlMinutes * 60)}s`)
      .sign(this.key);
  }

  async verify(token: string): Promise<string | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ['HS256'] });
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }
}
