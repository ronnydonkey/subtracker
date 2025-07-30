import * as nodemailer from 'nodemailer';

export interface ForwardingOptions {
  to: string;
  from: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  originalSender: string;
  receivedAt: Date;
}

export class EmailForwarder {
  private static transporter = nodemailer.createTransport({
    // Configure your SMTP settings here
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  static async forwardEmail(options: ForwardingOptions): Promise<boolean> {
    try {
      const forwardedSubject = `[SubTracker] ${options.subject}`;
      
      const forwardedHtml = this.createForwardedEmailHtml(options);
      const forwardedText = this.createForwardedEmailText(options);

      const mailOptions = {
        from: process.env.FORWARD_FROM_EMAIL || 'noreply@subtracker.app',
        to: options.to,
        subject: forwardedSubject,
        text: forwardedText,
        html: forwardedHtml,
        headers: {
          'X-Original-Sender': options.originalSender,
          'X-SubTracker-Forward': 'true',
        },
      };

      const result = await this.transporter.sendMail(mailOptions);
      return !!result.messageId;
    } catch (error) {
      console.error('Failed to forward email:', error);
      return false;
    }
  }

  private static createForwardedEmailHtml(options: ForwardingOptions): string {
    const headerInfo = `
      <div style="background-color: #f3f4f6; padding: 16px; margin-bottom: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px;">📧 Forwarded by SubTracker</h3>
        <p style="margin: 4px 0; color: #6b7280; font-size: 14px;"><strong>Original Sender:</strong> ${options.originalSender}</p>
        <p style="margin: 4px 0; color: #6b7280; font-size: 14px;"><strong>Received:</strong> ${options.receivedAt.toLocaleString()}</p>
        <p style="margin: 4px 0; color: #6b7280; font-size: 14px;"><strong>Subject:</strong> ${options.subject}</p>
      </div>
    `;

    const originalContent = options.bodyHtml || this.textToHtml(options.bodyText || '');
    
    return `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          ${headerInfo}
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
            ${originalContent}
          </div>
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
            <p>This email was forwarded by <a href="https://subtracker.app" style="color: #3b82f6;">SubTracker</a></p>
            <p>Manage your email preferences in your <a href="https://subtracker.app/email" style="color: #3b82f6;">SubTracker dashboard</a></p>
          </div>
        </body>
      </html>
    `;
  }

  private static createForwardedEmailText(options: ForwardingOptions): string {
    return `
📧 Forwarded by SubTracker

Original Sender: ${options.originalSender}
Received: ${options.receivedAt.toLocaleString()}
Subject: ${options.subject}

----------------------------------------

${options.bodyText || this.htmlToText(options.bodyHtml || '')}

----------------------------------------

This email was forwarded by SubTracker (https://subtracker.app)
Manage your email preferences: https://subtracker.app/email
    `.trim();
  }

  private static textToHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>');
  }

  private static htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  static async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('SMTP connection test failed:', error);
      return false;
    }
  }

  static async sendNotification(
    to: string,
    subject: string,
    content: string,
    isHtml: boolean = false
  ): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.NOTIFICATION_FROM_EMAIL || 'notifications@subtracker.app',
        to,
        subject: `[SubTracker] ${subject}`,
        [isHtml ? 'html' : 'text']: content,
        headers: {
          'X-SubTracker-Notification': 'true',
        },
      };

      const result = await this.transporter.sendMail(mailOptions);
      return !!result.messageId;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }
}