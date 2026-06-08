/**
 * BROkar Email Service
 *
 * Priority order:
 *   1. Gmail via Nodemailer  — set GMAIL_USER + GMAIL_APP_PASSWORD
 *   2. Resend                — set RESEND_API_KEY (requires verified domain for non-own-email recipients)
 *   3. Console fallback      — dev mode, no config needed
 *
 * Getting a Gmail App Password (takes 2 minutes):
 *   1. myaccount.google.com → Security → 2-Step Verification (enable if off)
 *   2. Search "App passwords" → Select app: Mail → Device: Other → name it "BROkar"
 *   3. Copy the 16-character password → paste as GMAIL_APP_PASSWORD in Railway
 */

import nodemailer from "nodemailer";
import { Resend } from "resend";

// ─── Transports (lazy-init) ───────────────────────────────────────────────────

function getGmailTransport() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    host:   "smtp.gmail.com",
    port:   465,
    secure: true,             // SSL — more reliable than STARTTLS on cloud hosts
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    connectionTimeout: 30_000,
    greetingTimeout:   30_000,
    socketTimeout:     30_000,
  });
}

let resendClient: Resend | null = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<void> {
  const subject = "Reset your BROkar password";
  const html    = passwordResetHtml(name, resetUrl);
  const text    = passwordResetText(name, resetUrl);

  // ── 1. Gmail (port 465 SSL) ──────────────────────────────────────────────
  const gmail = getGmailTransport();
  if (gmail) {
    const from = `BROkar <${process.env.GMAIL_USER}>`;
    await gmail.sendMail({ from, to, subject, html, text });
    console.log(`[email] Password reset email sent via Gmail to ${to}`);
    return;
  }

  // ── 2. Resend (requires verified domain for non-own-email recipients) ────
  const resend = getResend();
  if (resend) {
    const from = process.env.FROM_EMAIL || "BROkar <onboarding@resend.dev>";
    const { error } = await resend.emails.send({ from, to, subject, html, text });
    if (error) {
      console.error("[email] Resend error:", error);
      throw new Error("Failed to send reset email. Please try again.");
    }
    console.log(`[email] Password reset email sent via Resend to ${to}`);
    return;
  }

  // ── 3. Dev fallback ───────────────────────────────────────────────────────
  console.log(`\n[email] No mail provider configured. Reset link for ${to}:\n  ${resetUrl}\n`);
}

// ─── HTML Template ────────────────────────────────────────────────────────────

function passwordResetHtml(name: string, resetUrl: string): string {
  const firstName = name.split(" ")[0] || "there";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Reset your BROkar password</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:24px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#dc2626;border-radius:12px;padding:12px 20px;text-align:center;">
              <span style="color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">BRO</span><span style="color:rgba(255,255,255,0.85);font-size:26px;font-weight:400;">kar</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#ffffff;border-radius:16px;padding:40px 36px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Lock icon -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td align="center">
              <div style="display:inline-block;background:#fee2e2;border-radius:50%;padding:16px;line-height:0;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="#dc2626" stroke-width="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
            </td></tr>
          </table>

          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center;">Reset your password</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#6b7280;text-align:center;line-height:1.6;">
            Hi ${firstName}, we received a request to reset the password for your BROkar account.
          </p>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td align="center">
              <a href="${resetUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;">
                Reset Password
              </a>
            </td></tr>
          </table>

          <!-- Expiry -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:12px 16px;">
              <p style="margin:0;font-size:13px;color:#991b1b;text-align:center;">⏰ &nbsp;This link expires in <strong>1 hour</strong></p>
            </td></tr>
          </table>

          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">If the button doesn't work, copy and paste this link:</p>
          <p style="margin:0 0 24px;font-size:12px;color:#dc2626;word-break:break-all;">${resetUrl}</p>

          <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;" />
          <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;line-height:1.6;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 0 0;" align="center">
          <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} BROkar &nbsp;·&nbsp; Indian Real Estate Intelligence</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Plain-text fallback ──────────────────────────────────────────────────────

function passwordResetText(name: string, resetUrl: string): string {
  const firstName = name.split(" ")[0] || "there";
  return `Hi ${firstName},

We received a request to reset the password for your BROkar account.

Reset your password here:
${resetUrl}

This link expires in 1 hour.

If you didn't request this, you can safely ignore this email.

— The BROkar Team`;
}
