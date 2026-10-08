import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { ConsentsService } from './consents.service';

const mockOk = (data: unknown) =>
  of({ data, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } as any });

const mockAxiosError = (status: number, msg = 'Error') => {
  const err = new AxiosError(msg);
  (err as any).response = { status, data: { message: msg }, headers: {}, config: {} };
  return throwError(() => err);
};

describe('ConsentsService (widget-bff)', () => {
  let service: ConsentsService;
  let http: { get: jest.Mock; post: jest.Mock };

  beforeEach(async () => {
    http = { get: jest.fn(), post: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentsService,
        { provide: HttpService, useValue: http },
        {
          provide: ConfigService,
          useValue: { get: () => 'http://localhost:8002' },
        },
      ],
    }).compile();

    service = module.get<ConsentsService>(ConsentsService);
  });

  describe('checkConsent', () => {
    it('returns consent status from upstream', async () => {
      const status = { consented: true, consented_at: '2026-01-01T00:00:00Z' };
      http.get.mockReturnValue(mockOk(status));
      const result = await service.checkConsent({ user_email: 'u@test.com', project_id: 'app' });
      expect(result).toEqual(status);
    });

    it('sends query params to correct endpoint', async () => {
      http.get.mockReturnValue(mockOk({ consented: false, consented_at: null }));
      await service.checkConsent({ user_email: 'u@test.com', project_id: 'my-app' });
      expect(http.get).toHaveBeenCalledWith(
        'http://localhost:8002/api/v1/consents',
        expect.objectContaining({
          params: { user_email: 'u@test.com', project_id: 'my-app' },
        }),
      );
    });

    it('throws HttpException on upstream 422', async () => {
      http.get.mockReturnValue(mockAxiosError(422, 'Validation error'));
      await expect(service.checkConsent({})).rejects.toThrow(HttpException);
    });

    it('throws 503 when backend unreachable', async () => {
      const err = new AxiosError('Network Error');
      (err as any).request = {};
      http.get.mockReturnValue(throwError(() => err));
      try {
        await service.checkConsent({});
      } catch (e: any) {
        expect(e.getStatus()).toBe(503);
      }
    });
  });

  describe('recordConsent', () => {
    it('returns created consent record', async () => {
      const consent = { id: 'abc123', consented: true, user_email: 'u@test.com' };
      http.post.mockReturnValue(mockOk(consent));
      const result = await service.recordConsent(
        { user_email: 'u@test.com', consented: true },
        'my-app',
      );
      expect(result).toEqual(consent);
    });

    it('sends payload and X-Project-ID header to correct endpoint', async () => {
      http.post.mockReturnValue(mockOk({}));
      const payload = { user_email: 'u@test.com', project_id: 'my-app', consented: true };
      await service.recordConsent(payload, 'my-app');
      expect(http.post).toHaveBeenCalledWith(
        'http://localhost:8002/api/v1/consents',
        payload,
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Project-ID': 'my-app' }),
        }),
      );
    });

    it('throws HttpException on 422 upstream validation error', async () => {
      http.post.mockReturnValue(mockAxiosError(422, 'Missing fields'));
      await expect(service.recordConsent({}, 'app')).rejects.toThrow(HttpException);
    });

    it('throws HttpException on 500 upstream error', async () => {
      http.post.mockReturnValue(mockAxiosError(500, 'Internal error'));
      try {
        await service.recordConsent({}, 'app');
      } catch (e: any) {
        expect(e.getStatus()).toBe(500);
      }
    });
  });
});
