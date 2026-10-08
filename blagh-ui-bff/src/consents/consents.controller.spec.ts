import { Test, TestingModule } from '@nestjs/testing';
import { ConsentsController } from './consents.controller';
import { ConsentsService } from './consents.service';

const MOCK_STATUS = { consented: false, consented_at: null };
const MOCK_CONSENT = { id: 'abc123', consented: true, user_email: 'u@test.com' };

describe('ConsentsController (widget-bff)', () => {
  let controller: ConsentsController;
  let service: { checkConsent: jest.Mock; recordConsent: jest.Mock };

  beforeEach(async () => {
    service = {
      checkConsent: jest.fn().mockResolvedValue(MOCK_STATUS),
      recordConsent: jest.fn().mockResolvedValue(MOCK_CONSENT),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsentsController],
      providers: [{ provide: ConsentsService, useValue: service }],
    }).compile();

    controller = module.get<ConsentsController>(ConsentsController);
  });

  describe('checkConsent', () => {
    it('calls service with query params and returns result', async () => {
      const query = { user_email: 'u@test.com', project_id: 'my-app' };
      const result = await controller.checkConsent(query);
      expect(service.checkConsent).toHaveBeenCalledWith(query);
      expect(result).toEqual(MOCK_STATUS);
    });

    it('passes empty query without error', async () => {
      await controller.checkConsent({});
      expect(service.checkConsent).toHaveBeenCalledWith({});
    });
  });

  describe('recordConsent', () => {
    it('calls service with body and extracted project id string', async () => {
      const body = { user_email: 'u@test.com', consented: true };
      const result = await controller.recordConsent(body, 'my-app');
      expect(service.recordConsent).toHaveBeenCalledWith(body, 'my-app');
      expect(result).toEqual(MOCK_CONSENT);
    });

    it('passes empty string when no project id header', async () => {
      await controller.recordConsent({}, '');
      expect(service.recordConsent).toHaveBeenCalledWith({}, '');
    });

    it('passes the exact project id string received from header', async () => {
      const body = { user_email: 'u@test.com', consented: true };
      await controller.recordConsent(body, 'override-app');
      expect(service.recordConsent).toHaveBeenCalledWith(body, 'override-app');
    });

    it('passes undefined gracefully when header is missing', async () => {
      await controller.recordConsent({}, undefined as unknown as string);
      expect(service.recordConsent).toHaveBeenCalledWith({}, undefined);
    });
  });
});
