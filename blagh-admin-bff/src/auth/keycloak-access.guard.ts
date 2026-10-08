import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class KeycloakAccessGuard implements CanActivate {
  private readonly allowedUsernames: string[];
  private readonly userInfoUrl: string;
  private readonly logger = new Logger(KeycloakAccessGuard.name);

  constructor(
    config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.allowedUsernames = (config.get<string>('allowedSsoUsernames') || '')
      .split(',')
      .map((u: string) => u.trim())
      .filter(Boolean);
    this.userInfoUrl = config.get<string>('keycloakUserinfoUrl');
    if (this.allowedUsernames.length === 0) {
      this.logger.warn(
        'ALLOWED_SSO_USERNAMES is not set — all authenticated Keycloak users can access the admin panel.',
      );
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<any>();
    const token: string | undefined = req.body?.token;

    if (!token) {
      throw new UnauthorizedException('No SSO token provided');
    }

    let userInfo: Record<string, unknown>;
    try {
      const { data } = await firstValueFrom(
        this.http.get(this.userInfoUrl, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      userInfo = data;
    } catch {
      throw new UnauthorizedException('Invalid or expired SSO token');
    }

    if (this.allowedUsernames.length > 0) {
      const username = String(userInfo.preferred_username ?? userInfo.sub ?? '');
      if (!this.allowedUsernames.includes(username)) {
        throw new ForbiddenException(
          `User '${username}' does not have access to the admin panel`,
        );
      }
    }

    req.keycloakUser = {
      sub: userInfo.sub,
      preferred_username: userInfo.preferred_username,
      name: userInfo.name,
      given_name: userInfo.given_name,
      family_name: userInfo.family_name,
      email: userInfo.email,
      realm_access: userInfo.realm_access,
    };
    return true;
  }
}
