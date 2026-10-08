import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { handleUpstreamError } from '../common/upstream-error';

@Injectable()
export class ReportsService {
  private readonly backendUrl: string;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.backendUrl = config.get<string>('backendUrl');
  }

  async submitReport(body: Record<string, any>, projectId: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.backendUrl}/api/v1/reports`, body, {
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

  async getMyReports(query: Record<string, any>, projectId: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.backendUrl}/api/v1/reports`, {
          params: query,
          headers: { 'X-Project-ID': projectId || '' },
        }),
      );
      return data;
    } catch (error) {
      handleUpstreamError(error);
    }
  }
}
