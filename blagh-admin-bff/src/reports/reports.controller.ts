import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AuthHeaderGuard } from '../common/auth-header.guard';

@UseGuards(AuthHeaderGuard)
@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  getReports(@Query() query: Record<string, any>, @Req() req: any) {
    return this.reportsService.getReports(query, `Bearer ${req.adminToken}`);
  }

  @Get(':refId')
  getReport(@Param('refId') refId: string, @Req() req: any) {
    return this.reportsService.getReport(refId, `Bearer ${req.adminToken}`);
  }

  @Patch(':refId/status')
  @HttpCode(HttpStatus.OK)
  updateReportStatus(
    @Param('refId') refId: string,
    @Query('value') value: string,
    @Req() req: any,
  ) {
    return this.reportsService.updateReportStatus(refId, value, `Bearer ${req.adminToken}`);
  }
}
