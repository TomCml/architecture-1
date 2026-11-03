export interface PasswordHasherInterface {
  hash(password: string): Promise<string>;
  verify(password: string, stored: string): Promise<boolean>;
}
