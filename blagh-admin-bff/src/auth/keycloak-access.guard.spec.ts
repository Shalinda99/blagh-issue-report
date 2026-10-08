import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { KeycloakAccessGuard } from './keycloak-access.guard';

function makeCtx(body: Record<string, unknown> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ body }) }),
  } as unknown as ExecutionContext;
}

function makeGuard(allowedUsernames = '404', userInfo: Record<string, unknown> = { preferred_username: '404', sub: 'u1' }) {
  const httpService = {
    get: jest.fn().mockReturnValue(of({ data: userInfo, status: 200, statusText: 'OK', headers: {}, config: {} })),
  };
  const configService = {
    get: (key: string) => {
      if (key === 'allowedSsoUsernames') return allowedUsernames;
      if (key === 'keycloakUserinfoUrl') return 'https://kc.example.com/userinfo';
      return '';
    },
  };
  return new KeycloakAccessGuard(configService as any, httpService as any);
}

describe('KeycloakAccessGuard', () => {
  it('throws UnauthorizedException when no token in body', async () => {
    const guard = makeGuard();
    await expect(guard.canActivate(makeCtx({}))).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when SSO call fails', async () => {
    const httpService = {
      get: jest.fn().mockReturnValue(throwError(() => new AxiosError('fail'))),
    };
    const guard = new KeycloakAccessGuard(
      { get: (k: string) => (k === 'allowedSsoUsernames' ? '404' : 'https://kc.example.com/userinfo') } as any,
      httpService as any,
    );
    await expect(guard.canActivate(makeCtx({ token: 'bad-token' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws ForbiddenException when username not in allowed list', async () => {
    const guard = makeGuard('admin,superuser', { preferred_username: 'regular_user', sub: 'u2' });
    await expect(guard.canActivate(makeCtx({ token: 'valid-token' }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns true and sets req.keycloakUser when username is allowed', async () => {
    const guard = makeGuard('404', { preferred_username: '404', sub: 'u1', email: 'a@b.com' });
    const req: any = { body: { token: 'valid-token' } };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req.keycloakUser).toBeDefined();
    expect(req.keycloakUser.preferred_username).toBe('404');
  });

  it('allows all users when allowedUsernames is empty', async () => {
    const guard = makeGuard('', { preferred_username: 'anyone', sub: 'u3' });
    const req: any = { body: { token: 'valid-token' } };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('falls back to sub when preferred_username is missing', async () => {
    const guard = makeGuard('u-sub', { sub: 'u-sub' });
    const req: any = { body: { token: 'valid-token' } };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('populates all available keycloakUser fields', async () => {
    const userInfo = {
      sub: 'u1',
      preferred_username: '404',
      name: 'Admin User',
      given_name: 'Admin',
      family_name: 'User',
      email: 'admin@test.com',
      realm_access: { roles: ['admin'] },
    };
    const guard = makeGuard('404', userInfo);
    const req: any = { body: { token: 'tok' } };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
    await guard.canActivate(ctx);
    expect(req.keycloakUser.email).toBe('admin@test.com');
    expect(req.keycloakUser.realm_access).toEqual({ roles: ['admin'] });
  });
});
