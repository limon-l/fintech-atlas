export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INSUFFICIENT_FUNDS"
  | "ACCOUNT_FROZEN"
  | "IDEMPOTENCY_MISMATCH"
  | "QUOTE_EXPIRED"
  | "HOLD_STATE"
  | "RATE_LIMITED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INSUFFICIENT_FUNDS: 409,
  ACCOUNT_FROZEN: 409,
  IDEMPOTENCY_MISMATCH: 409,
  QUOTE_EXPIRED: 410,
  HOLD_STATE: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export function errorResponse(error: unknown): {
  status: number;
  body: { error: { code: string; message: string; details?: unknown } };
} {
  if (error instanceof DomainError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message, details: error.details } },
    };
  }
  if (error instanceof Error && error.name === "ZodError") {
    return {
      status: 422,
      body: { error: { code: "VALIDATION_ERROR", message: "Request validation failed" } },
    };
  }
  return {
    status: 500,
    body: { error: { code: "INTERNAL", message: "An unexpected error occurred" } },
  };
}
