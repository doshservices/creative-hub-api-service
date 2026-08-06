import type { ObjectId } from 'mongodb';

export type AccountType = 'client' | 'creative';

export interface AccountDocument {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
  permissions: string[];
  status: 'active' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

// The application-level uniqueness check in the service prevents most races on signup; this
// index prevents all of them.
export const accountIndexes = [{ key: { email: 1 }, name: 'email_unique', unique: true }] as const;
