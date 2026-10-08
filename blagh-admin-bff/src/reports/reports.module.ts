import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [HttpModule.register({ timeout: 10_000 })],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
