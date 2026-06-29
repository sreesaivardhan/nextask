import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface SendResetPasswordEmailOptions {
  to: string;
  resetToken: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      logger.warn('SMTP configuration is missing. Emails will not be sent.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    this.isConfigured = true;
  }

  public async sendResetPasswordEmail({ to, resetToken }: SendResetPasswordEmailOptions): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn(`Would have sent password reset email to ${to} with token ${resetToken}`);
      return;
    }

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;
    const from = process.env.SMTP_FROM || 'NexTask <noreply@nextask.com>';

    const subject = 'Reset your NexTask password';

    const text = `
You requested a password reset for your NexTask account.
Click the link below to reset your password:

${resetUrl}

This link will expire in 1 hour.
If you did not request a password reset, please ignore this email or contact support if you have concerns.
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f9fafb;
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .logo {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      text-align: center;
      margin-bottom: 30px;
    }
    .logo span {
      color: #3b82f6;
    }
    h1 {
      color: #0f172a;
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 16px;
      text-align: center;
    }
    p {
      color: #475569;
      font-size: 16px;
      margin-bottom: 24px;
    }
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    .button {
      background-color: #3b82f6;
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      display: inline-block;
    }
    .footer {
      margin-top: 32px;
      text-align: center;
      color: #94a3b8;
      font-size: 14px;
    }
    .warning {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      color: #92400e;
      font-size: 14px;
      margin-top: 32px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">Nex<span>Task</span></div>
      <h1>Reset your password</h1>
      <p>We received a request to reset the password for your NexTask account. If you made this request, please click the button below to choose a new password:</p>
      
      <div class="button-container">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </div>
      
      <p>Or copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a></p>
      
      <div class="warning">
        <strong>Security Warning:</strong> This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email. Your password will not change unless you click the link and create a new one.
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} NexTask. All rights reserved.
    </div>
  </div>
</body>
</html>
    `.trim();

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      logger.info(`Password reset email sent successfully to ${to}`);
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw new Error('Failed to send email');
    }
  }
}

export const emailService = new EmailService();
