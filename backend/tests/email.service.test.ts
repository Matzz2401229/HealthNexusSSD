jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

import nodemailer from 'nodemailer';
import { config } from '../src/config/env';
import { canExposeDevelopmentCode, sendEmail } from '../src/services/email.service';

const mockCreateTransport = nodemailer.createTransport as unknown as jest.Mock;

describe('email.service', () => {
  const originalEmail = { ...config.email };
  const originalNodeEnv = config.nodeEnv;
  const originalAllowDevCodes = config.allowDevCodes;

  beforeEach(() => {
    jest.clearAllMocks();
    config.email = {
      ...originalEmail,
      host: 'smtp.example.com',
      from: 'no-reply@example.com',
      user: 'smtp-user',
      password: 'smtp-password',
      secure: false,
      timeoutMs: 50,
      maxRetries: 1,
    };
    config.nodeEnv = 'production';
    config.allowDevCodes = false;
  });

  afterEach(() => {
    config.email = { ...originalEmail };
    config.nodeEnv = originalNodeEnv;
    config.allowDevCodes = originalAllowDevCodes;
  });

  it('uses TLS upgrade, timeouts, verify, sendMail, and closes the transporter', async () => {
    const transporter = {
      verify: jest.fn().mockResolvedValue(undefined),
      sendMail: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
    };
    mockCreateTransport.mockReturnValueOnce(transporter);

    await expect(sendEmail({
      to: 'patient@test.com',
      subject: 'Code',
      text: '123456',
    })).resolves.toBe(true);

    expect(mockCreateTransport).toHaveBeenCalledWith(expect.objectContaining({
      requireTLS: true,
      connectionTimeout: 50,
      greetingTimeout: 50,
      socketTimeout: 50,
    }));
    expect(transporter.verify).toHaveBeenCalledTimes(1);
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
    expect(transporter.close).toHaveBeenCalledTimes(1);
  });

  it('retries failed delivery and returns false after all attempts fail', async () => {
    const failingTransporter = {
      verify: jest.fn().mockRejectedValue(new Error('smtp down')),
      sendMail: jest.fn(),
      close: jest.fn(),
    };
    mockCreateTransport.mockReturnValue(failingTransporter);

    await expect(sendEmail({
      to: 'patient@test.com',
      subject: 'Code',
      text: '123456',
    })).resolves.toBe(false);

    expect(mockCreateTransport).toHaveBeenCalledTimes(2);
    expect(failingTransporter.close).toHaveBeenCalledTimes(2);
  });

  it('exposes development codes only in local dev with no SMTP configured', () => {
    config.nodeEnv = 'development';
    config.allowDevCodes = true;
    config.email.host = '';
    config.email.from = '';

    expect(canExposeDevelopmentCode()).toBe(true);

    config.email.host = 'smtp.example.com';
    config.email.from = 'no-reply@example.com';
    expect(canExposeDevelopmentCode()).toBe(false);
  });
});
