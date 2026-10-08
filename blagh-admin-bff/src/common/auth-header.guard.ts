import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AuthHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<any>();
    const token: string | undefined = req.cookies?.['csi_admin_session'];
    if (!token) {
      throw new UnauthorizedException('No active session — please log in');
    }

    try {
      const payloadB64 = token.split('.')[1];
      if (payloadB64) {
        const claims = JSON.parse(
          Buffer.from(
            payloadB64.replace(/-/g, '+').replace(/_/g, '/'),
            'base64',
          ).toString('utf8'),
        );
        if (claims.exp && claims.exp * 1000 < Date.now()) {
          throw new UnauthorizedException('Session expired — please log in again');
        }
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid session token — please log in again');
    }

    req.adminToken = token;
    return true;
  }
}
