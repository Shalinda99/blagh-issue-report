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
import { ConsentsService } from './consents.service';

@Controller('api/consents')
export class ConsentsController {
  constructor(private readonly consentsService: ConsentsService) {}

  @Get()
  checkConsent(@Query() query: Record<string, any>) {
    return this.consentsService.checkConsent(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  recordConsent(
    @Body() body: Record<string, any>,
    @Headers('x-project-id') projectId: string,
  ) {
    return this.consentsService.recordConsent(body, projectId);
  }
}
