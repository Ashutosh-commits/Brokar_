import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";

const ACCESS_TTL  = "15m";
const REFRESH_TTL = "7d";
const REFRESH_MS  = 7 * 24 * 60 * 60 * 1000;

// Lazily initialised so the server starts even if GOOGLE_CLIENT_ID is unset
let googleClient: OAuth2Client | null = null;
function getGoogleClient(): OAuth2Client {
  if (!googleClient) {
    const id = process.env.GOOGLE_CLIENT_ID;
    if (!id) throw Object.assign(new Error("Google login is not configured on the server"), { statusCode: 501 });
    googleClient = new OAuth2Client(id);
  }
  return googleClient;
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function registerUser(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // If they have a Google account, guide them to the right flow
    if (existing.provider === "google") {
      throw Object.assign(
        new Error("This email is linked to a Google account. Please sign in with Google."),
        { statusCode: 409 }
      );
    }
    throw Object.assign(
      new Error("An account with this email already exists"),
      { statusCode: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const username     = await uniqueUsername(name, email);
  const avatar       = dicebearUrl(email);

  const user = await prisma.user.create({
    data:   { email, passwordHash, name, username, avatar, provider: "email" },
    select: userSelect,
  });

  return { user, ...(await issueTokens(user.id, user.role)) };
}

// ─── Login ───────────────────────────────────────────────────────────────────

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
  }

  // Google-only account — no password was ever set
  if (!user.passwordHash) {
    throw Object.assign(
      new Error("This account uses Google sign-in. Please click 'Continue with Google' instead."),
      { statusCode: 401 }
    );
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
  }

  return {
    user: { id: user.id, email: user.email, name: user.name, username: user.username, avatar: user.avatar, role: user.role },
    ...(await issueTokens(user.id, user.role)),
  };
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────

export async function googleAuth(credential: string) {
  // 1. Verify the Google ID token — this hits Google's public key endpoint
  const client  = getGoogleClient();
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken:  credential,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });
  } catch {
    throw Object.assign(new Error("Invalid Google credential"), { statusCode: 401 });
  }

  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw Object.assign(new Error("Google did not return an email address"), { statusCode: 400 });
  }

  const { sub: googleId, email, name = email.split("@")[0], picture } = payload;

  // 2. Find existing user by googleId first, then fall back to email
  //    (handles the case where someone registered with email and now tries Google)
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId }, { email }] },
    select: { ...userSelect, googleId: true, provider: true },
  });

  if (user) {
    // Link the Google ID to an existing email account on first Google sign-in
    if (!user.googleId) {
      user = await prisma.user.update({
        where:  { id: user.id },
        data:   { googleId, provider: "google", avatar: user.avatar || picture || undefined },
        select: { ...userSelect, googleId: true, provider: true },
      });
    }
  } else {
    // Brand-new user — create from Google profile
    const username = await uniqueUsername(name, email);
    const avatar   = picture || dicebearUrl(email);

    user = await prisma.user.create({
      data:   { email, name, username, avatar, googleId, provider: "google" },
      select: { ...userSelect, googleId: true, provider: true },
    });
  }

  return {
    user: { id: user.id, email: user.email, name: user.name, username: user.username, avatar: user.avatar, role: user.role },
    ...(await issueTokens(user.id, user.role)),
  };
}

// ─── Refresh tokens ───────────────────────────────────────────────────────────

export async function refreshTokens(refreshToken: string) {
  let payload: { sub: string; role: string };
  try {
    payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET!) as any;
  } catch {
    throw Object.assign(new Error("Session expired, please log in again"), { statusCode: 401 });
  }

  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const session   = await prisma.session.findUnique({ where: { tokenHash } });

  if (!session || session.expiresAt < new Date()) {
    throw Object.assign(new Error("Session expired, please log in again"), { statusCode: 401 });
  }

  await prisma.session.deleteMany({ where: { tokenHash } });
  return issueTokens(payload.sub, payload.role);
}

// ─── Logout ──────────────────────────────────────────────────────────────────

export async function logoutUser(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const userSelect = {
  id: true, email: true, name: true,
  username: true, avatar: true, role: true,
} as const;

function dicebearUrl(seed: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}

async function uniqueUsername(name: string, email: string): Promise<string> {
  let base = name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!base) base = email.split("@")[0];
  let username = base;
  let attempt  = 0;
  while (await prisma.user.findUnique({ where: { username } })) {
    attempt  += 1;
    username  = `${base}${attempt}`;
  }
  return username;
}

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

  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt: new Date(Date.now() + REFRESH_MS) },
  });

  return { accessToken, refreshToken };
}
