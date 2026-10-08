import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { handleUpstreamError } from '../common/upstream-error';

@Injectable()
export class ConsentsService {
  private readonly backendUrl: string;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.backendUrl = config.get<string>('backendUrl');
  }

  async checkConsent(query: Record<string, any>) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.backendUrl}/api/v1/consents`, { params: query }),
      );
      return data;
    } catch (error) {
      handleUpstreamError(error);
    }
  }

  async recordConsent(body: Record<string, any>, projectId: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.backendUrl}/api/v1/consents`, body, {
          headers: {
            'Content-Type': 'application/json',
            'X-Project-ID': projectId || '',
          },
        }),
      );
      return data;
    } catch (error) {
      handleUpstreamError(error);
    }
  }
}
