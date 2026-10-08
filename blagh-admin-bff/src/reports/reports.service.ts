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

  async getReports(query: Record<string, any>, authHeader: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.backendUrl}/api/v1/admin/reports`, {
          params: query,
          headers: { Authorization: authHeader },
        }),
      );
      return data;
    } catch (error) {
      handleUpstreamError(error);
    }
  }

  async getReport(refId: string, authHeader: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(
          `${this.backendUrl}/api/v1/admin/reports/${refId}`,
          { headers: { Authorization: authHeader } },
        ),
      );
      return data;
    } catch (error) {
      handleUpstreamError(error);
    }
  }

  async updateReportStatus(
    refId: string,
    value: string,
    authHeader: string,
  ) {
    try {
      const { data } = await firstValueFrom(
        this.http.patch(
          `${this.backendUrl}/api/v1/admin/reports/${refId}/status`,
          null,
          {
            params: { value },
            headers: { Authorization: authHeader },
          },
        ),
      );
      return data;
    } catch (error) {
      handleUpstreamError(error);
    }
  }
}
