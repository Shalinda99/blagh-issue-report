import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let body: Record<string, unknown>;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      body = typeof res === 'object'
        ? (res as Record<string, unknown>)
        : { message: res };
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      body = { message: 'Internal server error', statusCode: 500 };
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${
          exception instanceof Error ? exception.stack : String(exception)
        }`,
      );
    }

    response.status(status).json(body);
  }
}
