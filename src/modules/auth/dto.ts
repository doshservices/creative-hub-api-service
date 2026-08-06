import type { AccountType } from './model.js';

export interface AccountDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
  permissions: string[];
  status: 'active' | 'suspended';
  createdAt: Date;
}

export interface AuthTokensDTO {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}
