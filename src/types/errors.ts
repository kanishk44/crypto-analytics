export type ErrorCode =
  | "VALIDATION_ERROR"
  | "TOKEN_NOT_FOUND"
  | "WALLET_NOT_FOUND"
  | "EXTERNAL_API_ERROR"
  | "AI_SERVICE_ERROR"
  | "DATABASE_ERROR"
  | "INTERNAL_ERROR";

export interface ApiErrorResponse {
  error: ErrorCode;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  toJSON(): ApiErrorResponse {
    return {
      error: this.code,
      message: this.message,
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends ApiError {
  constructor(code: ErrorCode, message: string) {
    super(404, code, message);
    this.name = "NotFoundError";
  }
}

export class ExternalApiError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(502, "EXTERNAL_API_ERROR", message, details);
    this.name = "ExternalApiError";
  }
}

export class AiServiceError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(503, "AI_SERVICE_ERROR", message, details);
    this.name = "AiServiceError";
  }
}

export class DatabaseError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(500, "DATABASE_ERROR", message, details);
    this.name = "DatabaseError";
  }
}

