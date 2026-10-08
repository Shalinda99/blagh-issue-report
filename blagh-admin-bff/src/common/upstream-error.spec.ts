import { HttpException } from '@nestjs/common';
import { AxiosError, AxiosHeaders } from 'axios';
import { handleUpstreamError } from './upstream-error';

function makeAxiosError(
  status: number,
  data: Record<string, unknown>,
  hasResponse = true,
  hasRequest = false,
): AxiosError {
  const err = new AxiosError('Request failed');
  if (hasResponse) {
    (err as any).response = { status, data, headers: {}, config: {} };
  }
  if (hasRequest) {
    (err as any).request = {};
  }
  return err;
}

describe('handleUpstreamError', () => {
  it('throws HttpException with upstream status for 4xx errors', () => {
    expect(() => handleUpstreamError(makeAxiosError(401, { message: 'Unauthorized' }))).toThrow(
      HttpException,
    );
    try {
      handleUpstreamError(makeAxiosError(401, { message: 'Unauthorized' }));
    } catch (e: any) {
      expect(e.getStatus()).toBe(401);
      expect(e.getResponse().message).toBe('Unauthorized');
    }
  });

  it('uses detail field when present for 4xx', () => {
    try {
      handleUpstreamError(makeAxiosError(422, { detail: 'Validation failed' }));
    } catch (e: any) {
      expect(e.getResponse().message).toBe('Validation failed');
    }
  });

  it('masks 5xx details with generic message', () => {
    try {
      handleUpstreamError(makeAxiosError(500, { message: 'Sensitive DB error' }));
    } catch (e: any) {
      expect(e.getStatus()).toBe(500);
      expect(e.getResponse().message).toContain('Upstream service error');
    }
  });

  it('returns 503 when request was made but no response received', () => {
    const err = new AxiosError('Network Error');
    (err as any).request = {};
    expect(() => handleUpstreamError(err)).toThrow(HttpException);
    try {
      handleUpstreamError(err);
    } catch (e: any) {
      expect(e.getStatus()).toBe(503);
    }
  });

  it('returns 500 for non-axios errors', () => {
    try {
      handleUpstreamError(new Error('Something went wrong'));
    } catch (e: any) {
      expect(e.getStatus()).toBe(500);
    }
  });

  it('returns 500 for unknown thrown values', () => {
    try {
      handleUpstreamError('plain string error');
    } catch (e: any) {
      expect(e.getStatus()).toBe(500);
    }
  });

  it('falls back to status code in message when no detail or message', () => {
    try {
      handleUpstreamError(makeAxiosError(404, {}));
    } catch (e: any) {
      expect(e.getResponse().message).toContain('404');
    }
  });
});
