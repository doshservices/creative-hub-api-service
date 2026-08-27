export interface RoleDTO {
  id: string;
  name: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RolePage {
  items: RoleDTO[];
  nextCursor: string | null;
}
