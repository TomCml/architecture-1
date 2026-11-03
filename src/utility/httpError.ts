export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const httpError = (statusCode: number, code: string, message: string): Error =>
  new HttpError(statusCode, code, message);

export const isHttpError = (error: unknown): error is HttpError => error instanceof HttpError;
