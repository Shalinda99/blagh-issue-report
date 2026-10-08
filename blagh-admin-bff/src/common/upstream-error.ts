import { HttpException } from '@nestjs/common';
import { isAxiosError } from 'axios';

/**
 * Normalises errors thrown by axios when calling the FastAPI backend
 * and re-throws them as NestJS HttpExceptions so the frontend gets
 * the correct HTTP status code and a clean message.
 */
export function handleUpstreamError(error: unknown): never {
  if (isAxiosError(error) && error.response) {
    const status = error.response.status;
    const data = error.response.data as Record<string, unknown>;
    // Do not forward internal server error details to clients
    const message =
      status < 500
        ? String(data?.detail ?? data?.message ?? `Request failed (${status})`)
        : `Upstream service error (${status})`;
    throw new HttpException({ message }, status);
  }

  if (isAxiosError(error) && error.request) {
    throw new HttpException(
      { message: 'Upstream service is unavailable. Please try again later.' },
      503,
    );
  }

  throw new HttpException({ message: 'Internal BFF error' }, 500);
}
