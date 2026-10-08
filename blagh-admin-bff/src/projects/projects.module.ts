import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [HttpModule.register({ timeout: 10_000 })],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
