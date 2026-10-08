import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

const MOCK_LIST = [{ ref_id: 'REF-001', status: 'open' }];
const MOCK_CREATED = { ref_id: 'REF-002', status: 'open' };

describe('ReportsController (widget-bff)', () => {
  let controller: ReportsController;
  let service: { submitReport: jest.Mock; getMyReports: jest.Mock };

  beforeEach(async () => {
    service = {
      submitReport: jest.fn().mockResolvedValue(MOCK_CREATED),
      getMyReports: jest.fn().mockResolvedValue(MOCK_LIST),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: service }],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  describe('getMyReports', () => {
    it('calls service with query and X-Project-ID header value', async () => {
      const result = await controller.getMyReports({ user_email: 'u@test.com' }, 'widget-app');
      expect(service.getMyReports).toHaveBeenCalledWith(
        { user_email: 'u@test.com' },
        'widget-app',
      );
      expect(result).toEqual(MOCK_LIST);
    });

    it('passes empty string when header is absent', async () => {
      await controller.getMyReports({}, '');
      expect(service.getMyReports).toHaveBeenCalledWith({}, '');
    });

    it('passes undefined project id gracefully', async () => {
      await controller.getMyReports({}, undefined as unknown as string);
      expect(service.getMyReports).toHaveBeenCalledWith({}, undefined);
    });
  });

  describe('submitReport', () => {
    it('calls service with body and X-Project-ID', async () => {
      const body = { summary: 'Bug report' };
      const result = await controller.submitReport(body, 'widget-app');
      expect(service.submitReport).toHaveBeenCalledWith(body, 'widget-app');
      expect(result).toEqual(MOCK_CREATED);
    });

    it('passes empty string when header is absent', async () => {
      await controller.submitReport({}, '');
      expect(service.submitReport).toHaveBeenCalledWith({}, '');
    });
  });
});
