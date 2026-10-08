import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { AuthHeaderGuard } from '../common/auth-header.guard';

@UseGuards(AuthHeaderGuard)
@Controller('api/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  getProjects(@Req() req: any) {
    return this.projectsService.getProjects(`Bearer ${req.adminToken}`);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createProject(@Body() body: Record<string, any>, @Req() req: any) {
    return this.projectsService.createProject(body, `Bearer ${req.adminToken}`);
  }

  @Patch(':appId')
  updateProject(
    @Param('appId') appId: string,
    @Body() body: Record<string, any>,
    @Req() req: any,
  ) {
    return this.projectsService.updateProject(appId, body, `Bearer ${req.adminToken}`);
  }
}
