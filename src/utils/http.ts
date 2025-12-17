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
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    console.error(`API Error ${response.status}:`, {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      body: text,
      headers: Object.fromEntries(response.headers.entries()),
    });
    throw new HttpError(
      response.status,
      `HTTP ${response.status}: ${text}`,
      { status: response.status, body: text, url: response.url }
    );
  }

  const json = await response.json().catch((error) => {
    throw new HttpError(502, 'Invalid JSON response from upstream', { error });
  });

  // Log raw response for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('Raw API response:', JSON.stringify(json, null, 2).substring(0, 500));
  }

  try {
    return schema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Schema validation failed. Raw response:', JSON.stringify(json, null, 2));
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
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
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

