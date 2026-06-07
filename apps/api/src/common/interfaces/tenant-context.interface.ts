import { OrganizationRole, UserRole } from '@prisma/client';

export interface TenantContext {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string;
  organizationRole: OrganizationRole;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId: string;
  organizationRole: OrganizationRole;
}
