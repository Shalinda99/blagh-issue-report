import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { ReportsService } from './reports.service';

const mockOk = (data: unknown) =>
  of({ data, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } as any });

const mockAxiosError = (status: number, msg = 'Error') => {
  const err = new AxiosError(msg);
  (err as any).response = { status, data: { message: msg }, headers: {}, config: {} };
  return throwError(() => err);
};

describe('ReportsService (widget-bff)', () => {
  let service: ReportsService;
  let http: { get: jest.Mock; post: jest.Mock };

  beforeEach(async () => {
    http = { get: jest.fn(), post: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: HttpService, useValue: http },
        {
          provide: ConfigService,
          useValue: { get: () => 'http://localhost:8002' },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('submitReport', () => {
    it('returns created report data', async () => {
      const created = { ref_id: 'REF-001', status: 'open' };
      http.post.mockReturnValue(mockOk(created));
      const result = await service.submitReport({ summary: 'Bug' }, 'my-app');
      expect(result).toEqual(created);
    });

    it('sends payload to correct endpoint with X-Project-ID header', async () => {
      http.post.mockReturnValue(mockOk({}));
      await service.submitReport({ summary: 'Test' }, 'widget-app');
      expect(http.post).toHaveBeenCalledWith(
        'http://localhost:8002/api/v1/reports',
        { summary: 'Test' },
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Project-ID': 'widget-app' }),
        }),
      );
    });

    it('throws HttpException on upstream 422', async () => {
      http.post.mockReturnValue(mockAxiosError(422, 'Validation error'));
      await expect(service.submitReport({}, 'app')).rejects.toThrow(HttpException);
    });

    it('throws 503 when backend is down', async () => {
      const err = new AxiosError('Network Error');
      (err as any).request = {};
      http.post.mockReturnValue(throwError(() => err));
      try {
        await service.submitReport({}, 'app');
      } catch (e: any) {
        expect(e.getStatus()).toBe(503);
      }
    });
  });

  describe('getMyReports', () => {
    it('returns reports list', async () => {
      const list = [{ ref_id: 'REF-001', status: 'open' }];
      http.get.mockReturnValue(mockOk(list));
      const result = await service.getMyReports({ user_email: 'u@test.com' }, 'my-app');
      expect(result).toEqual(list);
    });

    it('sends query params and X-Project-ID header', async () => {
      http.get.mockReturnValue(mockOk([]));
      await service.getMyReports({ user_email: 'u@test.com', limit: 10 }, 'my-app');
      expect(http.get).toHaveBeenCalledWith(
        'http://localhost:8002/api/v1/reports',
        expect.objectContaining({
          params: { user_email: 'u@test.com', limit: 10 },
          headers: { 'X-Project-ID': 'my-app' },
        }),
      );
    });

    it('throws HttpException on upstream error', async () => {
      http.get.mockReturnValue(mockAxiosError(400, 'Bad request'));
      await expect(service.getMyReports({}, 'app')).rejects.toThrow(HttpException);
    });
  });
});
