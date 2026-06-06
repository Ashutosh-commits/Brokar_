import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";
import { prisma } from "../lib/prisma";

const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Register ─────────────────────────────────────────────────────────────────

export async function registerUser(
  email: string,
  password: string,
  name: string
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error("An account with this email already exists") as any;
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Generate a username (ensure uniqueness by appending short suffix if needed)
  let baseUsername = name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!baseUsername) baseUsername = email.split("@")[0];
  let username = baseUsername;
  let attempt = 0;
  while (await prisma.user.findUnique({ where: { username } })) {
    attempt += 1;
    username = `${baseUsername}${attempt}`;
  }

  // Default avatar using dicebear seeded by email
  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`;

  const user = await prisma.user.create({
    data: { email, passwordHash, name, username, avatar },
    select: { id: true, email: true, name: true, username: true, avatar: true, role: true },
  });

  const tokens = await issueTokens(user.id, user.role);
  return { user, ...tokens };
}

// ─── Login ───────────────────────────────────────────────────────────────────

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const err = new Error("Invalid email or password") as any;
    err.statusCode = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const err = new Error("Invalid email or password") as any;
    err.statusCode = 401;
    throw err;
  }

  const tokens = await issueTokens(user.id, user.role);
  return {
    user: { id: user.id, email: user.email, name: user.name, username: user.username, avatar: user.avatar, role: user.role },
    ...tokens,
  };
}

// ─── Refresh tokens ───────────────────────────────────────────────────────────

export async function refreshTokens(refreshToken: string) {
  let payload: { sub: string; role: string };

  try {
    payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET!) as any;
  } catch {
    const err = new Error("Session expired, please log in again") as any;
    err.statusCode = 401;
    throw err;
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await prisma.session.findUnique({ where: { tokenHash } });
  if (!session || session.expiresAt < new Date()) {
    const err = new Error("Session expired, please log in again") as any;
    err.statusCode = 401;
    throw err;
  }

  // Rotate: delete old session and issue new pair
  await prisma.session.delete({ where: { tokenHash } });
  return issueTokens(payload.sub, payload.role);
}

// ─── Logout ──────────────────────────────────────────────────────────────────

export async function logoutUser(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function issueTokens(userId: string, role: string) {
  const accessToken = jwt.sign(
    { sub: userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: ACCESS_TTL }
  );

  const refreshToken = jwt.sign(
    { sub: userId, role },
    process.env.REFRESH_SECRET!,
    { expiresIn: REFRESH_TTL }
  );

  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + REFRESH_MS),
    },
  });

  return { accessToken, refreshToken };
}
