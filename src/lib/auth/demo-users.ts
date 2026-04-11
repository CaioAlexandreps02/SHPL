import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type DemoUser = {
  fullName: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  photoDataUrl?: string;
};

const dataDirectory = path.join(process.cwd(), "data");
const usersFile = path.join(dataDirectory, "demo-users.json");

async function ensureUsersFile() {
  await mkdir(dataDirectory, { recursive: true });

  try {
    await readFile(usersFile, "utf8");
  } catch {
    await writeFile(usersFile, "[]", "utf8");
  }
}

async function readUsers() {
  await ensureUsersFile();
  const raw = await readFile(usersFile, "utf8");
  return JSON.parse(stripBom(raw)) as DemoUser[];
}

async function writeUsers(users: DemoUser[]) {
  await writeFile(usersFile, JSON.stringify(users, null, 2), "utf8");
}

function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
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
  const users = await readUsers();
  const normalizedEmail = email.trim().toLowerCase();
  return users.find((user) => user.email === normalizedEmail) ?? null;
}

export async function getDemoUserPhotoMap() {
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
