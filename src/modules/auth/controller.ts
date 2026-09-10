import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AccountType } from './model.js';
import type { AuthService } from './service.js';

interface RegisterBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
}

interface CredentialsBody {
  email: string;
  password: string;
}

interface RefreshBody {
  refreshToken: string;
}

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export interface AccountIdParams {
  id: string;
}

export interface VerifyTwoFactorLoginBody {
  twoFactorToken: string;
  code: string;
}

export interface EnableTwoFactorBody {
  code: string;
}

export interface DisableTwoFactorBody {
  password: string;
  code: string;
}

export class AuthController {
  constructor(private readonly service: AuthService) {}

  register = async (
    request: FastifyRequest<{ Body: RegisterBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.register(request.body);
    await reply.code(201).send({ success: true, data });
  };

  login = async (
    request: FastifyRequest<{ Body: CredentialsBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.login(request.body.email, request.body.password);
    await reply.send({ success: true, data });
  };

  verifyTwoFactorLogin = async (
    request: FastifyRequest<{ Body: VerifyTwoFactorLoginBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.verifyTwoFactorLogin(
      request.body.twoFactorToken,
      request.body.code,
    );
    await reply.send({ success: true, data });
  };

  refresh = async (
    request: FastifyRequest<{ Body: RefreshBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.refresh(request.body.refreshToken);
    await reply.send({ success: true, data });
  };

  logout = async (
    request: FastifyRequest<{ Body: RefreshBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await this.service.logout(request.body.refreshToken);
    await reply.code(204).send();
  };

  me = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const data = await this.service.getById(request.user.sub);
    await reply.send({ success: true, data });
  };

  changePassword = async (
    request: FastifyRequest<{ Body: ChangePasswordBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await this.service.changePassword(
      request.user.sub,
      request.body.currentPassword,
      request.body.newPassword,
    );
    await reply.code(204).send();
  };

  setupTwoFactor = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const data = await this.service.setupTwoFactor(request.user.sub);
    await reply.send({ success: true, data });
  };

  enableTwoFactor = async (
    request: FastifyRequest<{ Body: EnableTwoFactorBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.enableTwoFactor(request.user.sub, request.body.code);
    await reply.send({ success: true, data });
  };

  disableTwoFactor = async (
    request: FastifyRequest<{ Body: DisableTwoFactorBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await this.service.disableTwoFactor(request.user.sub, request.body.password, request.body.code);
    await reply.code(204).send();
  };

  suspendAccount = async (
    request: FastifyRequest<{ Params: AccountIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.suspendAccount(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };

  reactivateAccount = async (
    request: FastifyRequest<{ Params: AccountIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.reactivateAccount(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };
}
