import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { AuthService } from './auth.service';

const MOCK_TOKEN_RESPONSE = {
  data: { access_token: 'mock-jwt', token_type: 'bearer' },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: {} } as any,
};

describe('AuthService', () => {
  let service: AuthService;
  let httpService: { post: jest.Mock };

  beforeEach(async () => {
    httpService = { post: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: HttpService, useValue: httpService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string> = {
                backendUrl: 'http://localhost:8002',
                adminServiceEmail: 'admin@internal',
                adminServicePassword: 'secret',
              };
              return map[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('returns token data on success', async () => {
      httpService.post.mockReturnValue(of(MOCK_TOKEN_RESPONSE));
      const result = await service.login('admin@internal', 'secret');
      expect(result).toEqual({ access_token: 'mock-jwt', token_type: 'bearer' });
    });

    it('calls the correct backend endpoint', async () => {
      httpService.post.mockReturnValue(of(MOCK_TOKEN_RESPONSE));
      await service.login('user@test.com', 'pw');
      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:8002/api/v1/admin/login',
        { email: 'user@test.com', password: 'pw' },
      );
    });

    it('propagates HttpException on 401 upstream', async () => {
      const err = new AxiosError('Unauthorized');
      (err as any).response = { status: 401, data: { message: 'Invalid credentials' }, headers: {}, config: {} };
      httpService.post.mockReturnValue(throwError(() => err));
      await expect(service.login('bad', 'bad')).rejects.toThrow(HttpException);
    });

    it('throws 503 when upstream is unreachable', async () => {
      const err = new AxiosError('Network Error');
      (err as any).request = {};
      httpService.post.mockReturnValue(throwError(() => err));
      try {
        await service.login('u', 'p');
      } catch (e: any) {
        expect(e.getStatus()).toBe(503);
      }
    });
  });

  describe('ssoLogin', () => {
    it('returns token + user data on success', async () => {
      httpService.post.mockReturnValue(of(MOCK_TOKEN_RESPONSE));
      const keycloakUser = { sub: 'kc-sub', preferred_username: 'admin' };
      const result = await service.ssoLogin(keycloakUser);
      expect(result.access_token).toBe('mock-jwt');
      expect(result.user).toEqual(keycloakUser);
    });

    it('uses service account credentials for the backend call', async () => {
      httpService.post.mockReturnValue(of(MOCK_TOKEN_RESPONSE));
      await service.ssoLogin({ sub: 'x' });
      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:8002/api/v1/admin/login',
        { email: 'admin@internal', password: 'secret' },
      );
    });

    it('propagates HttpException on upstream error', async () => {
      const err = new AxiosError('Error');
      (err as any).response = { status: 500, data: {}, headers: {}, config: {} };
      httpService.post.mockReturnValue(throwError(() => err));
      await expect(service.ssoLogin({ sub: 'x' })).rejects.toThrow(HttpException);
    });
  });
});
