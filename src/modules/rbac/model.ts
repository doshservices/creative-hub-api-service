import type { ObjectId } from 'mongodb';

export interface RoleDocument {
  _id: ObjectId;
  name: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const roleIndexes = [{ key: { name: 1 }, name: 'name_unique', unique: true }] as const;
