import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { handleUpstreamError } from '../common/upstream-error';

@Injectable()
export class ProjectsService {
  private readonly backendUrl: string;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.backendUrl = config.get<string>('backendUrl');
  }

  async getProjects(authHeader: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.backendUrl}/api/v1/projects`, {
          headers: { Authorization: authHeader },
        }),
      );
      return data;
    } catch (error) {
      handleUpstreamError(error);
    }
  }

  async createProject(body: Record<string, any>, authHeader: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.backendUrl}/api/v1/projects`, body, {
          headers: { Authorization: authHeader },
        }),
      );
      return data;
    } catch (error) {
      handleUpstreamError(error);
    }
  }

  async updateProject(
    appId: string,
    body: Record<string, any>,
    authHeader: string,
  ) {
    try {
      const { data } = await firstValueFrom(
        this.http.patch(
          `${this.backendUrl}/api/v1/projects/${appId}`,
          body,
          { headers: { Authorization: authHeader } },
        ),
      );
      return data;
    } catch (error) {
      handleUpstreamError(error);
    }
  }
}
