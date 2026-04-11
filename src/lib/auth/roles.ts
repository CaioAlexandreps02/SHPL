export type AccessRole = "Visitante" | "Jogador" | "Dealer" | "Administrador";

export type AccessRoleCarrier = {
  roles: AccessRole[];
};

export function hasAnyRole(
  access: AccessRoleCarrier | null,
  roles: AccessRole[],
) {
  if (!access) {
    return false;
  }

  return roles.some((role) => access.roles.includes(role));
}

export function isAdmin(access: AccessRoleCarrier | null) {
  return hasAnyRole(access, ["Administrador"]);
}

export function canManageTable(access: AccessRoleCarrier | null) {
  return hasAnyRole(access, ["Administrador", "Dealer"]);
}
