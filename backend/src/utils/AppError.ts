
export class AppError extends Error {
  public readonly code: number;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(code: number, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;

    // TypeScript workaround for capturing stack trace
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }
}

