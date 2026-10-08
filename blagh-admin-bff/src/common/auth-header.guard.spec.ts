import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthHeaderGuard } from './auth-header.guard';

function makeContext(cookies: Record<string, string> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ cookies }),
    }),
  } as unknown as ExecutionContext;
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fakesig`;
}

describe('AuthHeaderGuard', () => {
  let guard: AuthHeaderGuard;

  beforeEach(() => {
    guard = new AuthHeaderGuard();
  });

  it('throws UnauthorizedException when no session cookie is present', () => {
    expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when cookie is empty string', () => {
    expect(() => guard.canActivate(makeContext({ csi_admin_session: '' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('returns true and sets req.adminToken for a valid non-expired token', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeJwt({ sub: 'admin', exp });
    const req: any = { cookies: { csi_admin_session: token } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    const result = guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req.adminToken).toBe(token);
  });

  it('throws UnauthorizedException for an expired token', () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    const token = makeJwt({ sub: 'admin', exp });
    expect(() => guard.canActivate(makeContext({ csi_admin_session: token }))).toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException for a malformed token (bad base64)', () => {
    const token = 'header.!!!invalid_base64!!!.sig';
    expect(() => guard.canActivate(makeContext({ csi_admin_session: token }))).toThrow(
      UnauthorizedException,
    );
  });

  it('returns true for a token without exp claim (no expiry enforcement)', () => {
    const token = makeJwt({ sub: 'admin' });
    const req: any = { cookies: { csi_admin_session: token } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    const result = guard.canActivate(ctx);
    expect(result).toBe(true);
  });
});
