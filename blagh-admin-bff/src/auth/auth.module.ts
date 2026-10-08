import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { KeycloakAccessGuard } from './keycloak-access.guard';

@Module({
  imports: [HttpModule.register({ timeout: 10_000 })],
  controllers: [AuthController],
  providers: [AuthService, KeycloakAccessGuard],
})
export class AuthModule {}
