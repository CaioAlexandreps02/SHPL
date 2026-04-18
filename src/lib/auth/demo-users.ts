import { createHash } from "node:crypto";

import { readServerJsonDocument, writeServerJsonDocument } from "@/lib/data/server-json-store";
import {
  createServiceRoleSupabaseClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/server";

type DemoUser = {
  fullName: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  photoDataUrl?: string;
};

const usersDocumentName = "demo-users.json";

async function readUsers(): Promise<DemoUser[]> {
  return readServerJsonDocument<DemoUser[]>(usersDocumentName, () => [] as DemoUser[]);
}

async function writeUsers(users: DemoUser[]) {
  await writeServerJsonDocument(usersDocumentName, users);
}

function hashPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

export async function createDemoUser(input: {
  fullName: string;
  email: string;
  password: string;
}) {
  const users = await readUsers();
  const normalizedEmail = input.email.trim().toLowerCase();

  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error("Ja existe uma conta cadastrada com este email.");
  }

  users.push({
    fullName: input.fullName.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(input.password),
    createdAt: new Date().toISOString(),
    photoDataUrl: "",
  });

  await writeUsers(users);
}

export async function validateDemoUser(input: {
  email: string;
  password: string;
}) {
  const users = await readUsers();
  const normalizedEmail = input.email.trim().toLowerCase();
  const passwordHash = hashPassword(input.password);

  return users.find(
    (user) => user.email === normalizedEmail && user.passwordHash === passwordHash
  );
}

export async function getDemoUserByEmail(email: string) {
  if (hasSupabaseServiceRoleEnv) {
    const supabase = createServiceRoleSupabaseClient();

    if (supabase) {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (!error) {
        const authUser = data.users.find(
          (user) => user.email?.trim().toLowerCase() === normalizedEmail
        );

        if (authUser?.email) {
          return {
            fullName:
              typeof authUser.user_metadata?.full_name === "string"
                ? authUser.user_metadata.full_name
                : authUser.email.split("@")[0],
            email: authUser.email,
            passwordHash: "",
            createdAt: authUser.created_at ?? new Date().toISOString(),
            photoDataUrl:
              typeof authUser.user_metadata?.photo_data_url === "string"
                ? authUser.user_metadata.photo_data_url
                : "",
          } satisfies DemoUser;
        }
      }
    }
  }

  const users = await readUsers();
  const normalizedEmail = email.trim().toLowerCase();
  return users.find((user) => user.email === normalizedEmail) ?? null;
}

export async function getDemoUserPhotoMap() {
  if (hasSupabaseServiceRoleEnv) {
    const supabase = createServiceRoleSupabaseClient();

    if (supabase) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (!error) {
        return new Map(
          data.users
            .filter(
              (user) =>
                Boolean(user.email) &&
                typeof user.user_metadata?.photo_data_url === "string" &&
                user.user_metadata.photo_data_url
            )
            .map((user) => [
              user.email!.trim().toLowerCase(),
              user.user_metadata.photo_data_url as string,
            ])
        );
      }
    }
  }

  const users = await readUsers();

  return new Map(
    users
      .filter((user) => Boolean(user.photoDataUrl))
      .map((user) => [user.email.trim().toLowerCase(), user.photoDataUrl ?? ""])
  );
}

export async function updateDemoUserProfile(input: {
  currentEmail: string;
  fullName: string;
  nextEmail: string;
  password?: string;
  photoDataUrl?: string;
}) {
  if (hasSupabaseServiceRoleEnv) {
    const supabase = createServiceRoleSupabaseClient();

    if (!supabase) {
      throw new Error("Nao foi possivel iniciar o Supabase.");
    }

    const normalizedCurrentEmail = input.currentEmail.trim().toLowerCase();
    const normalizedNextEmail = input.nextEmail.trim().toLowerCase();
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      throw new Error("Nao foi possivel localizar a conta no Supabase.");
    }

    const authUser = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedCurrentEmail
    );

    if (!authUser) {
      throw new Error("Conta nao encontrada.");
    }

    const nextMetadata = {
      ...(authUser.user_metadata ?? {}),
      full_name: input.fullName.trim(),
      photo_data_url: input.photoDataUrl ?? authUser.user_metadata?.photo_data_url ?? "",
    };

    const { data: updatedData, error: updateError } = await supabase.auth.admin.updateUserById(
      authUser.id,
      {
        email: normalizedNextEmail,
        password: input.password?.trim() ? input.password : undefined,
        user_metadata: nextMetadata,
      }
    );

    if (updateError || !updatedData.user?.email) {
      throw new Error(updateError?.message ?? "Nao foi possivel atualizar o perfil.");
    }

    return {
      fullName:
        typeof updatedData.user.user_metadata?.full_name === "string"
          ? updatedData.user.user_metadata.full_name
          : input.fullName.trim(),
      email: updatedData.user.email,
      passwordHash: "",
      createdAt: updatedData.user.created_at ?? new Date().toISOString(),
      photoDataUrl:
        typeof updatedData.user.user_metadata?.photo_data_url === "string"
          ? updatedData.user.user_metadata.photo_data_url
          : "",
    } satisfies DemoUser;
  }

  const users = await readUsers();
  const normalizedCurrentEmail = input.currentEmail.trim().toLowerCase();
  const normalizedNextEmail = input.nextEmail.trim().toLowerCase();
  const userIndex = users.findIndex((user) => user.email === normalizedCurrentEmail);

  if (userIndex < 0) {
    throw new Error("Conta nao encontrada.");
  }

  if (!input.fullName.trim()) {
    throw new Error("Informe seu nome.");
  }

  if (!normalizedNextEmail) {
    throw new Error("Informe seu email.");
  }

  const duplicatedUser = users.find(
    (user, index) => index !== userIndex && user.email === normalizedNextEmail
  );

  if (duplicatedUser) {
    throw new Error("Ja existe outra conta com este email.");
  }

  users[userIndex] = {
    ...users[userIndex],
    fullName: input.fullName.trim(),
    email: normalizedNextEmail,
    photoDataUrl: input.photoDataUrl ?? users[userIndex].photoDataUrl ?? "",
    passwordHash: input.password?.trim()
      ? hashPassword(input.password)
      : users[userIndex].passwordHash,
  };

  await writeUsers(users);
  return users[userIndex];
}
