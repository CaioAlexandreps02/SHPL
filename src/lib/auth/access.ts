import { cookies } from "next/headers";

import { resolveParticipantAccessByEmail } from "@/lib/data/demo-admin-store";
import {
  canManageTable,
  hasAnyRole,
  isAdmin,
  type AccessRole,
} from "@/lib/auth/roles";
import { AUTH_COOKIE, readSessionValue } from "@/lib/auth/session";

export type UserAccess = {
  email: string;
  isParticipant: boolean;
  roles: AccessRole[];
};

export async function resolveUserAccessByEmail(email: string): Promise<UserAccess> {
  const access = await resolveParticipantAccessByEmail(email);

  return {
    email,
    isParticipant: access.isParticipant,
    roles: access.roles as AccessRole[],
  };
}

export async function getUserAccessFromCookieHeader(cookieHeader: string) {
  const cookieMatch = cookieHeader.match(new RegExp(`${AUTH_COOKIE}=([^;]+)`));

  if (!cookieMatch) {
    return null;
  }

  const session = readSessionValue(cookieMatch[1]);

  if (!session?.email) {
    return null;
  }

  return resolveUserAccessByEmail(session.email);
}

export async function getCurrentUserAccess() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(AUTH_COOKIE)?.value;

  if (!sessionCookie) {
    return null;
  }

  const session = readSessionValue(sessionCookie);

  if (!session?.email) {
    return null;
  }

  return resolveUserAccessByEmail(session.email);
}
export { canManageTable, hasAnyRole, isAdmin };
