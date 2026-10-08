import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { handleUpstreamError } from '../common/upstream-error';

@Injectable()
export class AuthService {
  private readonly backendUrl: string;
  private readonly adminServiceEmail: string;
  private readonly adminServicePassword: string;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.backendUrl = config.get<string>('backendUrl');
    this.adminServiceEmail = config.get<string>('adminServiceEmail');
    this.adminServicePassword = config.get<string>('adminServicePassword');
  }

  async login(email: string, password: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.backendUrl}/api/v1/admin/login`, {
          email,
          password,
        }),
      );
      return data;
    } catch (error) {
      handleUpstreamError(error);
    }
  }

  async ssoLogin(keycloakUser: Record<string, unknown>) {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.backendUrl}/api/v1/admin/login`, {
          email: this.adminServiceEmail,
          password: this.adminServicePassword,
        }),
      );
      return { ...data, user: keycloakUser };
    } catch (error) {
      handleUpstreamError(error);
    }
  }
}
