import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { ProjectsService } from './projects.service';

const mockOk = (data: unknown) =>
  of({ data, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } as any });

const mockAxiosError = (status: number, msg = 'Error') => {
  const err = new AxiosError(msg);
  (err as any).response = { status, data: { message: msg }, headers: {}, config: {} };
  return throwError(() => err);
};

describe('ProjectsService (admin-bff)', () => {
  let service: ProjectsService;
  let http: { get: jest.Mock; post: jest.Mock; patch: jest.Mock };

  beforeEach(async () => {
    http = { get: jest.fn(), post: jest.fn(), patch: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: HttpService, useValue: http },
        {
          provide: ConfigService,
          useValue: { get: () => 'http://localhost:8002' },
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('getProjects', () => {
    it('returns projects array', async () => {
      const list = [{ app_id: 'my-app', name: 'My App' }];
      http.get.mockReturnValue(mockOk(list));
      const result = await service.getProjects('Bearer tok');
      expect(result).toEqual(list);
    });

    it('forwards auth header', async () => {
      http.get.mockReturnValue(mockOk([]));
      await service.getProjects('Bearer admin-jwt');
      expect(http.get).toHaveBeenCalledWith(
        'http://localhost:8002/api/v1/projects',
        expect.objectContaining({ headers: { Authorization: 'Bearer admin-jwt' } }),
      );
    });

    it('throws HttpException on upstream 401', async () => {
      http.get.mockReturnValue(mockAxiosError(401));
      await expect(service.getProjects('Bearer bad')).rejects.toThrow(HttpException);
    });
  });

  describe('createProject', () => {
    it('returns created project', async () => {
      const project = { app_id: 'new-app', name: 'New App', is_active: true };
      http.post.mockReturnValue(mockOk(project));
      const result = await service.createProject({ app_id: 'new-app', name: 'New App' }, 'Bearer tok');
      expect(result).toEqual(project);
    });

    it('throws HttpException on 409 conflict', async () => {
      http.post.mockReturnValue(mockAxiosError(409, 'Conflict'));
      await expect(
        service.createProject({ app_id: 'dup', name: 'Dup' }, 'Bearer tok'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('updateProject', () => {
    it('returns updated project', async () => {
      const updated = { app_id: 'app', name: 'Updated', is_active: false };
      http.patch.mockReturnValue(mockOk(updated));
      const result = await service.updateProject('app', { name: 'Updated' }, 'Bearer tok');
      expect(result).toEqual(updated);
    });

    it('sends correct url and body', async () => {
      http.patch.mockReturnValue(mockOk({}));
      await service.updateProject('my-app', { is_active: false }, 'Bearer tok');
      expect(http.patch).toHaveBeenCalledWith(
        'http://localhost:8002/api/v1/projects/my-app',
        { is_active: false },
        expect.objectContaining({ headers: { Authorization: 'Bearer tok' } }),
      );
    });

    it('throws HttpException on 404', async () => {
      http.patch.mockReturnValue(mockAxiosError(404, 'Not found'));
      await expect(service.updateProject('ghost', {}, 'Bearer tok')).rejects.toThrow(HttpException);
    });
  });
});
