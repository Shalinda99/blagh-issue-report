import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  getMyReports(
    @Query() query: Record<string, any>,
    @Headers('x-project-id') projectId: string,
  ) {
    return this.reportsService.getMyReports(query, projectId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  submitReport(
    @Body() body: Record<string, any>,
    @Headers('x-project-id') projectId: string,
  ) {
    return this.reportsService.submitReport(body, projectId);
  }
}
