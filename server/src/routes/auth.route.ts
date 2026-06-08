import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  registerUser,
  loginUser,
  googleAuth,
  refreshTokens,
  logoutUser,
} from "../services/authService";
import { sendPasswordResetEmail } from "../services/emailService";
import { authenticate, AuthRequest } from "../middleware/authenticate";
import { authLimiter } from "../middleware/rateLimiter";
import { prisma } from "../lib/prisma";

const router = Router();

const registerSchema = z.object({
  email:    z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name:     z.string().min(2, "Name must be at least 2 characters"),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/register
router.post("/register", authLimiter, async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }
  try {
    const { email, password, name } = result.data;
    const data = await registerUser(email, password, name);
    res.status(201).json(data);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid email or password" });
    return;
  }
  try {
    const { email, password } = result.data;
    const data = await loginUser(email, password);
    res.json(data);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/auth/google
// Verifies a Google ID token, upserts the user, and returns BROkar JWT tokens.
router.post("/google", authLimiter, async (req: Request, res: Response) => {
  const { credential } = req.body;
  if (!credential || typeof credential !== "string") {
    res.status(400).json({ error: "Google credential is required" });
    return;
  }
  try {
    const data = await googleAuth(credential);
    res.json(data);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/auth/refresh
router.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: "Refresh token required" });
    return;
  }
  try {
    const tokens = await refreshTokens(refreshToken);
    res.json(tokens);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post("/logout", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await logoutUser(req.userId!);
    res.json({ message: "Logged out successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: "Email is required" }); return; }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond the same way — prevents email enumeration attacks
    const okResponse = { message: "If an account with that email exists, a reset link has been sent." };

    if (!user) { res.json(okResponse); return; }

    // Google-only accounts have no password to reset
    if (!user.passwordHash) { res.json(okResponse); return; }

    // Generate a secure reset token
    const resetToken     = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const expiresAt      = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.upsert({
      where:  { userId: user.id },
      create: { userId: user.id, tokenHash: resetTokenHash, expiresAt },
      update: { tokenHash: resetTokenHash, expiresAt },
    });

    // Build the reset URL — points at the frontend with token + email as params
    const clientUrl  = (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim();
    const resetUrl   = `${clientUrl}?reset_token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Send the email (falls back to console.log if RESEND_API_KEY is not set)
    try {
      await sendPasswordResetEmail(email, user.name, resetUrl);
    } catch (emailErr: any) {
      console.error("[auth] Failed to send reset email:", emailErr.message);
      res.status(500).json({ error: emailErr.message || "Failed to send reset email. Please try again." });
      return;
    }

    res.json({
      ...okResponse,
      // Only expose the raw URL in development so devs can test without email
      devResetUrl: process.env.NODE_ENV === "development" ? resetUrl : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, email, newPassword } = req.body;
    if (!token || !email || !newPassword) {
      res.status(400).json({ error: "Token, email, and new password are required" });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { res.status(400).json({ error: "Invalid or expired reset link" }); return; }

    const tokenHash   = crypto.createHash("sha256").update(token).digest("hex");
    const resetRecord = await prisma.passwordResetToken.findUnique({ where: { userId: user.id } });

    if (!resetRecord || resetRecord.tokenHash !== tokenHash || resetRecord.expiresAt < new Date()) {
      res.status(400).json({ error: "This reset link has expired or already been used. Please request a new one." });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await prisma.passwordResetToken.delete({ where: { userId: user.id } });
    // Invalidate all active sessions so old devices must re-login
    await prisma.session.deleteMany({ where: { userId: user.id } });

    res.json({ message: "Password reset successfully. Please log in with your new password." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
