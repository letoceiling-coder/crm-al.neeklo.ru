import { api } from './api';

export type MarketplacePackageType =
  | 'ASSISTANT'
  | 'WORKFLOW'
  | 'TOOL'
  | 'KNOWLEDGE_TEMPLATE'
  | 'AUTOMATION_PACKAGE';

export type MarketplaceVisibility = 'PUBLIC' | 'PRIVATE' | 'ORG_ONLY';
export type MarketplacePackageStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface MarketplaceCategory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  sortOrder: number;
}

export interface MarketplacePackage {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: MarketplacePackageType;
  version: string;
  status: MarketplacePackageStatus;
  visibility: MarketplaceVisibility;
  downloads: number;
  installs: number;
  rating: number;
  ratingCount: number;
  icon?: string;
  banner?: string;
  isVerified: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; slug: string; name: string };
  author?: { id: string; name?: string; email: string };
  organization?: { id: string; name: string; slug: string };
  versions?: Array<{
    id: string;
    version: string;
    changelog?: string;
    publishedAt?: string;
    manifest?: Record<string, unknown>;
  }>;
  reviews?: Array<{
    id: string;
    rating: number;
    comment?: string;
    createdAt: string;
    organization?: { id: string; name: string };
    user?: { id: string; name?: string };
  }>;
  _count?: { reviews: number; installsLog: number; versions: number };
}

export interface MarketplaceInstall {
  id: string;
  status: string;
  clonedEntities: Record<string, unknown>;
  createdAt: string;
  package: MarketplacePackage;
  version: { id: string; version: string; changelog?: string };
}

export interface FeaturedPackages {
  featured: MarketplacePackage[];
  popular: MarketplacePackage[];
  newest: MarketplacePackage[];
  topRated: MarketplacePackage[];
  mostInstalled: MarketplacePackage[];
}

export const PACKAGE_TYPE_LABELS: Record<MarketplacePackageType, string> = {
  ASSISTANT: 'AI Ассистент',
  WORKFLOW: 'Workflow',
  TOOL: 'Инструмент',
  KNOWLEDGE_TEMPLATE: 'База знаний',
  AUTOMATION_PACKAGE: 'Automation Package',
};

export const VISIBILITY_LABELS: Record<MarketplaceVisibility, string> = {
  PUBLIC: 'Публичный',
  PRIVATE: 'Приватный',
  ORG_ONLY: 'Только организация',
};

export const marketplaceApi = {
  listPackages: (params?: Record<string, string>) =>
    api.get<MarketplacePackage[]>('/v1/marketplace/packages', { params }).then((r) => r.data),
  getPackage: (id: string) =>
    api.get<MarketplacePackage>(`/v1/marketplace/packages/${id}`).then((r) => r.data),
  createPackage: (body: Record<string, unknown>) =>
    api.post<MarketplacePackage>('/v1/marketplace/packages', body).then((r) => r.data),
  updatePackage: (id: string, body: Record<string, unknown>) =>
    api.patch<MarketplacePackage>(`/v1/marketplace/packages/${id}`, body).then((r) => r.data),
  publishVersion: (id: string, body: Record<string, unknown>) =>
    api.post(`/v1/marketplace/packages/${id}/publish`, body).then((r) => r.data),
  unpublish: (id: string) =>
    api.post(`/v1/marketplace/packages/${id}/unpublish`).then((r) => r.data),
  getAnalytics: (id: string) =>
    api.get(`/v1/marketplace/packages/${id}/analytics`).then((r) => r.data),
  listCategories: () =>
    api.get<MarketplaceCategory[]>('/v1/marketplace/categories').then((r) => r.data),
  install: (packageId: string, version?: string) =>
    api.post('/v1/marketplace/install', { packageId, version }).then((r) => r.data),
  listInstalled: () =>
    api.get<MarketplaceInstall[]>('/v1/marketplace/installed').then((r) => r.data),
  createReview: (body: { packageId: string; rating: number; comment?: string }) =>
    api.post('/v1/marketplace/reviews', body).then((r) => r.data),
  getFeatured: (limit = 12) =>
    api.get<FeaturedPackages>('/v1/marketplace/featured', { params: { limit } }).then((r) => r.data),
};
