import { HttpException } from '@nestjs/common';
import { AxiosError } from 'axios';
import { handleUpstreamError } from './upstream-error';

function makeAxiosError(status: number, data: Record<string, unknown>, hasResponse = true): AxiosError {
  const err = new AxiosError('Request failed');
  if (hasResponse) {
    (err as any).response = { status, data, headers: {}, config: {} };
  }
  return err;
}

describe('handleUpstreamError (widget-bff)', () => {
  it('re-throws HttpException with upstream status for 4xx', () => {
    try {
      handleUpstreamError(makeAxiosError(404, { detail: 'Not found' }));
    } catch (e: any) {
      expect(e.getStatus()).toBe(404);
      expect(e.getResponse().message).toBe('Not found');
    }
  });

  it('uses message field as fallback for 4xx', () => {
    try {
      handleUpstreamError(makeAxiosError(403, { message: 'Forbidden' }));
    } catch (e: any) {
      expect(e.getResponse().message).toBe('Forbidden');
    }
  });

  it('masks 5xx errors with generic message', () => {
    try {
      handleUpstreamError(makeAxiosError(502, { message: 'Internal error details' }));
    } catch (e: any) {
      expect(e.getStatus()).toBe(502);
      expect(e.getResponse().message).toContain('Upstream service error');
    }
  });

  it('returns 503 when request was sent but no response received', () => {
    const err = new AxiosError('Network Error');
    (err as any).request = {};
    try {
      handleUpstreamError(err);
    } catch (e: any) {
      expect(e.getStatus()).toBe(503);
    }
  });

  it('returns 500 for plain Error', () => {
    try {
      handleUpstreamError(new Error('boom'));
    } catch (e: any) {
      expect(e.getStatus()).toBe(500);
      expect(e.getResponse().message).toBe('Internal BFF error');
    }
  });

  it('falls back to status code in message when no detail or message field', () => {
    try {
      handleUpstreamError(makeAxiosError(422, {}));
    } catch (e: any) {
      expect(e.getResponse().message).toContain('422');
    }
  });

  it('throws HttpException for all cases', () => {
    expect(() => handleUpstreamError(makeAxiosError(400, { detail: 'bad' }))).toThrow(HttpException);
    expect(() => {
      const e = new AxiosError('net');
      (e as any).request = {};
      handleUpstreamError(e);
    }).toThrow(HttpException);
    expect(() => handleUpstreamError('string error')).toThrow(HttpException);
  });
});
