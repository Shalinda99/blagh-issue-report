import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

const MOCK_LIST = { items: [{ ref_id: 'REF-001' }], total: 1, page: 1, page_size: 20, pages: 1 };
const MOCK_REPORT = { ref_id: 'REF-001', status: 'open' };
const MOCK_UPDATED = { ref_id: 'REF-001', status: 'resolved' };

describe('ReportsController (admin-bff)', () => {
  let controller: ReportsController;
  let service: { getReports: jest.Mock; getReport: jest.Mock; updateReportStatus: jest.Mock };

  beforeEach(async () => {
    service = {
      getReports: jest.fn().mockResolvedValue(MOCK_LIST),
      getReport: jest.fn().mockResolvedValue(MOCK_REPORT),
      updateReportStatus: jest.fn().mockResolvedValue(MOCK_UPDATED),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: service }],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  describe('getReports', () => {
    it('calls service with query and Bearer token', async () => {
      const req = { adminToken: 'admin-jwt' };
      const result = await controller.getReports({ status: 'open' }, req);
      expect(service.getReports).toHaveBeenCalledWith(
        { status: 'open' },
        'Bearer admin-jwt',
      );
      expect(result).toEqual(MOCK_LIST);
    });

    it('passes empty query when no filters', async () => {
      const req = { adminToken: 'tok' };
      await controller.getReports({}, req);
      expect(service.getReports).toHaveBeenCalledWith({}, 'Bearer tok');
    });
  });

  describe('getReport', () => {
    it('calls service with refId and Bearer token', async () => {
      const req = { adminToken: 'admin-jwt' };
      const result = await controller.getReport('REF-001', req);
      expect(service.getReport).toHaveBeenCalledWith('REF-001', 'Bearer admin-jwt');
      expect(result).toEqual(MOCK_REPORT);
    });
  });

  describe('updateReportStatus', () => {
    it('calls service with refId, value and Bearer token', async () => {
      const req = { adminToken: 'admin-jwt' };
      const result = await controller.updateReportStatus('REF-001', 'resolved', req);
      expect(service.updateReportStatus).toHaveBeenCalledWith(
        'REF-001',
        'resolved',
        'Bearer admin-jwt',
      );
      expect(result).toEqual(MOCK_UPDATED);
    });
  });
});
