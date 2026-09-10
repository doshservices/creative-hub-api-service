import type { ObjectId } from 'mongodb';

// One profile per client account — separate document/collection from CreativeProfileDocument
// since it's a distinct aggregate with a distinct lifecycle (companies, not talent).
export interface EmployerProfileDocument {
  _id: ObjectId;
  accountId: ObjectId;
  companyName: string;
  industry: string | null;
  bio: string | null;
  logoFileKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const employerProfileIndexes = [
  { key: { accountId: 1 }, name: 'accountId_unique', unique: true },
] as const;
