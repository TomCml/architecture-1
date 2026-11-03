export interface TokenServiceInterface {
  sign(userId: string): Promise<string>;
  verify(token: string): Promise<string | null>;
}
