import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

function isConfigured(): boolean {
  return Boolean(config.email.host && config.email.from);
}

function createTransporter() {
  const options: SMTPTransport.Options & { pool: boolean } = {
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    pool: true,
    connectionTimeout: config.email.timeoutMs,
    greetingTimeout: config.email.timeoutMs,
    socketTimeout: config.email.timeoutMs,
    requireTLS: !config.email.secure,
  };

  if (config.email.user && config.email.password) {
    options.auth = {
      user: config.email.user,
      pass: config.email.password,
    };
  }

  return nodemailer.createTransport(options);
}

async function waitBeforeRetry(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, Math.min(250 * attempt, 1000)));
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  if (!isConfigured()) {
    logger.warn('Email delivery not configured; outbound email was not sent', {
      to: message.to,
      subject: message.subject,
    });
    return false;
  }

  let lastError: unknown;
  const maxAttempts = Math.max(1, config.email.maxRetries + 1);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const transporter = createTransporter();
    try {
      await transporter.verify();
      await transporter.sendMail({
        from: config.email.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
      transporter.close();
      return true;
    } catch (err) {
      lastError = err;
      transporter.close();
      if (attempt < maxAttempts) {
        await waitBeforeRetry(attempt);
      }
    }
  }

  logger.error('Failed to send email', {
    to: message.to,
    error: lastError instanceof Error ? lastError.message : 'Unknown email error',
  });
  return false;
}

export function canExposeDevelopmentCode(): boolean {
  return config.isDev() && config.allowDevCodes && !isConfigured();
}
