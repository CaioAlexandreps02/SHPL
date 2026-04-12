import { canManageTable, type AccessRole } from "@/lib/auth/roles";

export type SHPLNavAccess = "all" | "admin" | "table";

export type SHPLNavItem = {
  href: string;
  label: string;
  icon: string;
  access: SHPLNavAccess;
};

export const shplNavItems: SHPLNavItem[] = [
  { href: "/shpl-2026/dashboard", label: "Dashboard", icon: "D", access: "all" },
  { href: "/shpl-2026/jogadores", label: "Participantes", icon: "P", access: "admin" },
  { href: "/shpl-2026/ranking", label: "Ranking", icon: "R", access: "all" },
  { href: "/shpl-2026/etapas", label: "Etapas", icon: "E", access: "all" },
  { href: "/shpl-2026/transmissao", label: "Transmissao", icon: "T", access: "table" },
  { href: "/shpl-2026/historico", label: "Historico", icon: "H", access: "admin" },
  { href: "/shpl-2026/estatisticas", label: "Estatisticas", icon: "S", access: "all" },
  { href: "/shpl-2026/configuracoes", label: "Configuracoes", icon: "C", access: "admin" },
];

export function getVisibleShplNavItems(roles: AccessRole[]) {
  const access = { roles };

  return shplNavItems.filter((item) =>
    item.access === "all"
      ? true
      : item.access === "admin"
        ? roles.includes("Administrador")
        : canManageTable(access)
  );
}

export function isShplNavItemActive(pathname: string, href: string) {
  if (href === "/shpl-2026/etapas") {
    return pathname === href || pathname.startsWith("/stages/");
  }

  return pathname === href;
}
