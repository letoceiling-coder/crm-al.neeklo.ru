export type UserRole = "admin" | "manager";

export const ROLES: Record<UserRole, string> = {
  admin: "Администратор",
  manager: "Менеджер",
};

export function isAdmin(role: string | undefined | null): boolean {
  return role === "admin";
}

export const ADMIN_ONLY_PATHS = [
  "/usage",
  "/settings/ai",
  "/users",
];

/** Пополнения — только админ; баланс и usage aura доступны менеджерам на дашборде */
export const ADMIN_ONLY_API_PREFIXES = [
  "/api/usage",
  "/api/settings/ai",
  "/api/aura/top-ups",
  "/api/users",
];

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function isAdminOnlyApi(pathname: string): boolean {
  return ADMIN_ONLY_API_PREFIXES.some((p) => pathname.startsWith(p));
}
