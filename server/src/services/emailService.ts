/**
 * BROkar Email Service
 *
 * Uses Resend (https://resend.com) to send transactional emails.
 * Free tier: 3,000 emails / month — no credit card required.
 *
 * Setup:
 *   1. Sign up at https://resend.com
 *   2. API Keys → Create API Key → copy it
 *   3. Add to server/.env:
 *        RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
 *        FROM_EMAIL=BROkar <onboarding@resend.dev>    ← free, no domain needed
 *      Or with your own verified domain:
 *        FROM_EMAIL=BROkar <no-reply@yourdomain.com>
 *
 * If RESEND_API_KEY is not set the reset URL is logged to the console
 * (existing dev behaviour — nothing breaks).
 */

import { Resend } from "resend";

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

// ─── Password Reset ───────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<void> {
  const resend = getClient();

  if (!resend) {
    // Graceful dev fallback — still works without Resend configured
    console.log(`\n[email] RESEND_API_KEY not set. Reset link for ${to}:\n  ${resetUrl}\n`);
    return;
  }

  const from =
    process.env.FROM_EMAIL || "BROkar <onboarding@resend.dev>";

  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Reset your BROkar password",
    html:    passwordResetHtml(name, resetUrl),
    text:    passwordResetText(name, resetUrl),
  });

  if (error) {
    // Don't expose Resend errors to the caller — just log and continue.
    // The reset token is still valid; the user can request again.
    console.error("[email] Resend error:", error);
    throw new Error("Failed to send reset email. Please try again.");
  }

  console.log(`[email] Password reset email sent to ${to}`);
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
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo / Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#dc2626;border-radius:12px;padding:12px 20px;text-align:center;">
                    <span style="color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">BRO</span><span style="color:rgba(255,255,255,0.85);font-size:26px;font-weight:400;">kar</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:40px 36px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

              <!-- Icon -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:#fee2e2;border-radius:50%;padding:16px;line-height:0;">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="11" width="18" height="11" rx="2" stroke="#dc2626" stroke-width="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    </div>
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center;">Reset your password</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;text-align:center;line-height:1.6;">
                Hi ${firstName}, we received a request to reset the password for your BROkar account.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}"
                       style="display:inline-block;background:#dc2626;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:12px 16px;">
                    <p style="margin:0;font-size:13px;color:#991b1b;text-align:center;">
                      ⏰ &nbsp;This link expires in <strong>1 hour</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Fallback URL -->
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">If the button doesn't work, copy and paste this URL into your browser:</p>
              <p style="margin:0 0 24px;font-size:12px;color:#dc2626;word-break:break-all;">${resetUrl}</p>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;" />

              <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email.<br/>
                Your password will remain unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;" align="center">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © ${new Date().getFullYear()} BROkar &nbsp;·&nbsp; Indian Real Estate Intelligence
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
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

If you didn't request a password reset, you can safely ignore this email.

— The BROkar Team
`;
}
