import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConsentsController } from './consents.controller';
import { ConsentsService } from './consents.service';

@Module({
  imports: [HttpModule.register({ timeout: 10_000 })],
  controllers: [ConsentsController],
  providers: [ConsentsService],
})
export class ConsentsModule {}
