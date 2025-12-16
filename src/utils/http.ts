import { z } from 'zod';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpError(504, `Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

export async function parseJsonResponse<T>(
  response: Response,
  schema: z.ZodSchema<T>
): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new HttpError(
      response.status,
      `HTTP ${response.status}: ${text}`,
      { status: response.status, body: text }
    );
  }

  const json = await response.json().catch((error) => {
    throw new HttpError(502, 'Invalid JSON response from upstream', { error });
  });

  try {
    return schema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new HttpError(
        502,
        'Upstream response validation failed',
        { zodErrors: error.errors, received: json }
      );
    }
    throw error;
  }
}

export async function fetchWithRetry<T>(
  url: string,
  schema: z.ZodSchema<T>,
  options: RequestInit = {},
  maxRetries = 2
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);
      return await parseJsonResponse(response, schema);
    } catch (error) {
      lastError = error;
      if (error instanceof HttpError && error.statusCode < 500) {
        throw error;
      }
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError;
}

