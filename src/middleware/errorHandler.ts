import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../types/errors.ts";
import { logger } from "../utils/logger.ts";
import { env } from "../config/env.ts";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    logger.warn(`API Error: ${err.code}`, {
      message: err.message,
      statusCode: err.statusCode,
      details: err.details,
    });

    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  // Unexpected errors
  logger.error("Unhandled error", {
    name: err.name,
    message: err.message,
    stack: env.NODE_ENV === "development" ? err.stack : undefined,
  });

  res.status(500).json({
    error: "INTERNAL_ERROR",
    message: env.NODE_ENV === "production" 
      ? "An unexpected error occurred" 
      : err.message,
  });
}

