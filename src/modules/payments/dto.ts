import type { DepositStatus } from './deposit.model.js';
import type { WithdrawalStatus } from './withdrawal.model.js';

export interface DepositDTO {
  id: string;
  accountId: string;
  amountMinor: number;
  currency: string;
  txRef: string;
  checkoutUrl: string | null;
  status: DepositStatus;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepositPage {
  items: DepositDTO[];
  nextCursor: string | null;
}

export interface WithdrawalDTO {
  id: string;
  accountId: string;
  amountMinor: number;
  currency: string;
  reference: string;
  bankCode: string;
  accountNumber: string;
  status: WithdrawalStatus;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WithdrawalPage {
  items: WithdrawalDTO[];
  nextCursor: string | null;
}
