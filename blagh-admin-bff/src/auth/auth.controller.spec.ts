import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { KeycloakAccessGuard } from './keycloak-access.guard';
import { AuthHeaderGuard } from '../common/auth-header.guard';

const mockResponse = () => {
  const res: any = {};
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { login: jest.Mock; ssoLogin: jest.Mock };

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue({ access_token: 'token123', token_type: 'bearer' }),
      ssoLogin: jest.fn().mockResolvedValue({
        access_token: 'sso-token',
        token_type: 'bearer',
        user: { sub: 'u1', preferred_username: 'admin' },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(KeycloakAccessGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthHeaderGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login', () => {
    it('calls authService.login with email and password', async () => {
      const res = mockResponse();
      await controller.login({ email: 'a@b.com', password: 'pw' }, res);
      expect(authService.login).toHaveBeenCalledWith('a@b.com', 'pw');
    });

    it('sets the session cookie', async () => {
      const res = mockResponse();
      await controller.login({ email: 'a@b.com', password: 'pw' }, res);
      expect(res.cookie).toHaveBeenCalledWith(
        'csi_admin_session',
        'token123',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('returns empty object', async () => {
      const res = mockResponse();
      const result = await controller.login({ email: 'a@b.com', password: 'pw' }, res);
      expect(result).toEqual({});
    });
  });

  describe('ssoLogin', () => {
    it('calls authService.ssoLogin with keycloakUser', async () => {
      const res = mockResponse();
      const req = { keycloakUser: { sub: 'u1' } };
      await controller.ssoLogin(req, res);
      expect(authService.ssoLogin).toHaveBeenCalledWith({ sub: 'u1' });
    });

    it('sets the session cookie with sso token', async () => {
      const res = mockResponse();
      await controller.ssoLogin({ keycloakUser: {} }, res);
      expect(res.cookie).toHaveBeenCalledWith(
        'csi_admin_session',
        'sso-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('returns user info in response', async () => {
      const res = mockResponse();
      const result = await controller.ssoLogin({ keycloakUser: {} }, res);
      expect(result).toHaveProperty('user');
    });
  });

  describe('logout', () => {
    it('clears the session cookie', () => {
      const res = mockResponse();
      controller.logout(res);
      expect(res.clearCookie).toHaveBeenCalledWith('csi_admin_session', { path: '/' });
    });

    it('returns logged out message', () => {
      const res = mockResponse();
      const result = controller.logout(res);
      expect(result).toHaveProperty('message');
    });
  });

  describe('me', () => {
    it('returns ok', () => {
      expect(controller.me()).toEqual({ ok: true });
    });
  });
});
