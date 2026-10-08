import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

const MOCK_LIST = [{ app_id: 'app1', name: 'App 1' }];
const MOCK_PROJECT = { app_id: 'app1', name: 'App 1', is_active: true };
const MOCK_UPDATED = { app_id: 'app1', name: 'Updated', is_active: false };

describe('ProjectsController (admin-bff)', () => {
  let controller: ProjectsController;
  let service: {
    getProjects: jest.Mock;
    createProject: jest.Mock;
    updateProject: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getProjects: jest.fn().mockResolvedValue(MOCK_LIST),
      createProject: jest.fn().mockResolvedValue(MOCK_PROJECT),
      updateProject: jest.fn().mockResolvedValue(MOCK_UPDATED),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [{ provide: ProjectsService, useValue: service }],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  describe('getProjects', () => {
    it('calls service with Bearer token and returns result', async () => {
      const req = { adminToken: 'admin-jwt' };
      const result = await controller.getProjects(req);
      expect(service.getProjects).toHaveBeenCalledWith('Bearer admin-jwt');
      expect(result).toEqual(MOCK_LIST);
    });
  });

  describe('createProject', () => {
    it('calls service with body and Bearer token', async () => {
      const req = { adminToken: 'admin-jwt' };
      const body = { app_id: 'app1', name: 'App 1' };
      const result = await controller.createProject(body, req);
      expect(service.createProject).toHaveBeenCalledWith(body, 'Bearer admin-jwt');
      expect(result).toEqual(MOCK_PROJECT);
    });
  });

  describe('updateProject', () => {
    it('calls service with appId, body and Bearer token', async () => {
      const req = { adminToken: 'admin-jwt' };
      const body = { name: 'Updated', is_active: false };
      const result = await controller.updateProject('app1', body, req);
      expect(service.updateProject).toHaveBeenCalledWith('app1', body, 'Bearer admin-jwt');
      expect(result).toEqual(MOCK_UPDATED);
    });
  });
});
