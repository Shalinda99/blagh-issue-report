import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { ReportsService } from './reports.service';

const mockOk = (data: unknown) =>
  of({ data, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } as any });

const mockAxiosError = (status: number, message = 'Error') => {
  const err = new AxiosError(message);
  (err as any).response = { status, data: { message }, headers: {}, config: {} };
  return throwError(() => err);
};

describe('ReportsService (admin-bff)', () => {
  let service: ReportsService;
  let http: { get: jest.Mock; patch: jest.Mock };

  beforeEach(async () => {
    http = { get: jest.fn(), patch: jest.fn() };

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

  describe('getReports', () => {
    it('returns data from upstream', async () => {
      const payload = { items: [], total: 0, page: 1, page_size: 20, pages: 0 };
      http.get.mockReturnValue(mockOk(payload));
      const result = await service.getReports({ page: 1 }, 'Bearer tok');
      expect(result).toEqual(payload);
    });

    it('forwards query and auth header', async () => {
      http.get.mockReturnValue(mockOk({}));
      await service.getReports({ status: 'open' }, 'Bearer mytoken');
      expect(http.get).toHaveBeenCalledWith(
        'http://localhost:8002/api/v1/admin/reports',
        expect.objectContaining({
          params: { status: 'open' },
          headers: { Authorization: 'Bearer mytoken' },
        }),
      );
    });

    it('throws HttpException on upstream 401', async () => {
      http.get.mockReturnValue(mockAxiosError(401));
      await expect(service.getReports({}, 'Bearer bad')).rejects.toThrow(HttpException);
    });

    it('throws 503 when upstream is unreachable', async () => {
      const err = new AxiosError('Network Error');
      (err as any).request = {};
      http.get.mockReturnValue(throwError(() => err));
      try {
        await service.getReports({}, 'Bearer tok');
      } catch (e: any) {
        expect(e.getStatus()).toBe(503);
      }
    });
  });

  describe('getReport', () => {
    it('returns single report data', async () => {
      const report = { ref_id: 'REF-001', status: 'open' };
      http.get.mockReturnValue(mockOk(report));
      const result = await service.getReport('REF-001', 'Bearer tok');
      expect(result).toEqual(report);
    });

    it('throws 404 HttpException when not found', async () => {
      http.get.mockReturnValue(mockAxiosError(404, 'Not found'));
      try {
        await service.getReport('REF-GHOST', 'Bearer tok');
      } catch (e: any) {
        expect(e.getStatus()).toBe(404);
      }
    });
  });

  describe('updateReportStatus', () => {
    it('returns updated report', async () => {
      const updated = { ref_id: 'REF-001', status: 'resolved' };
      http.patch.mockReturnValue(mockOk(updated));
      const result = await service.updateReportStatus('REF-001', 'resolved', 'Bearer tok');
      expect(result).toEqual(updated);
    });

    it('sends correct params', async () => {
      http.patch.mockReturnValue(mockOk({}));
      await service.updateReportStatus('REF-001', 'closed', 'Bearer tok');
      expect(http.patch).toHaveBeenCalledWith(
        'http://localhost:8002/api/v1/admin/reports/REF-001/status',
        null,
        expect.objectContaining({ params: { value: 'closed' } }),
      );
    });

    it('throws HttpException on upstream 422', async () => {
      http.patch.mockReturnValue(mockAxiosError(422, 'Invalid status'));
      await expect(service.updateReportStatus('REF-001', 'bad', 'Bearer tok')).rejects.toThrow(
        HttpException,
      );
    });
  });
});
