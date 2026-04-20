import { canManageTable, type AccessRole } from "@/lib/auth/roles";

export type SHPLNavAccess = "all" | "admin" | "table";

export type SHPLNavItem = {
  href: string;
  label: string;
  icon: string;
  iconSrc?: string;
  access: SHPLNavAccess;
};

export const shplNavItems: SHPLNavItem[] = [
  {
    href: "/shpl-2026/dashboard",
    label: "Dashboard",
    icon: "D",
    iconSrc: "/icons/shpl-menu/dashboard.svg",
    access: "all",
  },
  {
    href: "/shpl-2026/jogadores",
    label: "Participantes",
    icon: "P",
    iconSrc: "/icons/shpl-menu/participantes.svg",
    access: "admin",
  },
  {
    href: "/shpl-2026/ranking",
    label: "Ranking",
    icon: "R",
    iconSrc: "/icons/shpl-menu/ranking.svg",
    access: "all",
  },
  {
    href: "/shpl-2026/etapas",
    label: "Etapas",
    icon: "E",
    iconSrc: "/icons/shpl-menu/etapas.svg",
    access: "all",
  },
  {
    href: "/shpl-2026/transmissao",
    label: "Transmissao",
    icon: "T",
    iconSrc: "/icons/shpl-menu/transmissao.svg",
    access: "table",
  },
  {
    href: "/shpl-2026/historico",
    label: "Historico",
    icon: "H",
    iconSrc: "/icons/shpl-menu/historico.svg",
    access: "admin",
  },
  {
    href: "/shpl-2026/estatisticas",
    label: "Estatisticas",
    icon: "S",
    iconSrc: "/icons/shpl-menu/estatisticas.svg",
    access: "all",
  },
  {
    href: "/shpl-2026/configuracoes",
    label: "Configuracoes",
    icon: "C",
    iconSrc: "/icons/shpl-menu/configuracoes.svg",
    access: "admin",
  },
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
