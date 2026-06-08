import { MarketplacePackageStatus, MarketplaceVisibility, Prisma } from '@prisma/client';

/** Packages visible to a tenant in browse/install flows. */
export function marketplaceBrowseWhere(organizationId: string): Prisma.MarketplacePackageWhereInput {
  return {
    status: MarketplacePackageStatus.PUBLISHED,
    OR: [
      { visibility: MarketplaceVisibility.PUBLIC },
      { organizationId, visibility: { in: [MarketplaceVisibility.PRIVATE, MarketplaceVisibility.ORG_ONLY] } },
    ],
  };
}

export function canViewPackage(
  pkg: { organizationId: string; visibility: MarketplaceVisibility; status: MarketplacePackageStatus },
  tenantOrganizationId: string,
): boolean {
  if (pkg.organizationId === tenantOrganizationId) return true;
  if (pkg.status !== MarketplacePackageStatus.PUBLISHED) return false;
  return pkg.visibility === MarketplaceVisibility.PUBLIC;
}
