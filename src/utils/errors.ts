import { Request, Response, NextFunction } from 'express';
import { HttpError } from './http';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        statusCode: err.statusCode,
        ...(process.env.NODE_ENV === 'development' && { details: err.details }),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: 'Validation error',
        statusCode: 400,
        details: err.errors,
      },
    });
    return;
  }

  if (err instanceof Error) {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: {
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        statusCode: 500,
      },
    });
    return;
  }

  res.status(500).json({
    error: {
      message: 'Unknown error occurred',
      statusCode: 500,
    },
  });
}

