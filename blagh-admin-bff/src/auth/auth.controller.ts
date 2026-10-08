import {
  Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { KeycloakAccessGuard } from './keycloak-access.guard';
import { AuthHeaderGuard } from '../common/auth-header.guard';

const SESSION_COOKIE = 'csi_admin_session';
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000,
};

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.login(body.email, body.password);
    res.cookie(SESSION_COOKIE, data.access_token, cookieOptions);
    return {};
  }

  @Post('sso')
  @HttpCode(HttpStatus.OK)
  @UseGuards(KeycloakAccessGuard)
  async ssoLogin(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.ssoLogin(req.keycloakUser);
    res.cookie(SESSION_COOKIE, data.access_token, cookieOptions);
    return { user: data.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(AuthHeaderGuard)
  me() {
    return { ok: true };
  }
}
