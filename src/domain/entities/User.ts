export interface UserProps {
  id: string;
  email: string;
  createdAt: Date;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export class User {
  constructor(public readonly props: UserProps) {}

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  static isValidEmail(normalizedEmail: string): boolean {
    return normalizedEmail.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(normalizedEmail);
  }

  static isValidPassword(password: string): boolean {
    return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
  }

  get id() { return this.props.id; }
  get email() { return this.props.email; }
  get createdAt() { return this.props.createdAt; }

  toJSON() {
    return { id: this.id, email: this.email, createdAt: this.createdAt.toISOString() };
  }
}
