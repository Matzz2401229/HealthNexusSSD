import net from 'net';
import tls from 'tls';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

function mailboxFromAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim();
}

function isConfigured(): boolean {
  return Boolean(config.email.host && config.email.from);
}

function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

function escapeHeader(value: string): string {
  return value.replace(/[\r\n]/g, ' ').trim();
}

function readResponse(socket: net.Socket | tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    const onData = (chunk: Buffer) => {
      data += chunk.toString('utf8');
      const lines = data.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1];
      if (last && /^\d{3} /.test(last)) {
        cleanup();
        resolve(data);
      }
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onError);
    };
    socket.on('data', onData);
    socket.on('error', onError);
  });
}

async function command(socket: net.Socket | tls.TLSSocket, line: string): Promise<string> {
  socket.write(`${line}\r\n`);
  return readResponse(socket);
}

async function connect(): Promise<net.Socket | tls.TLSSocket> {
  const socket = config.email.secure
    ? tls.connect({ host: config.email.host, port: config.email.port, servername: config.email.host })
    : net.connect({ host: config.email.host, port: config.email.port });

  await new Promise<void>((resolve, reject) => {
    socket.once(config.email.secure ? 'secureConnect' : 'connect', () => resolve());
    socket.once('error', reject);
  });

  await readResponse(socket);
  await command(socket, `EHLO ${config.email.host}`);

  if (!config.email.secure) {
    await command(socket, 'STARTTLS');
    const secureSocket = tls.connect({ socket, servername: config.email.host });
    await new Promise<void>((resolve, reject) => {
      secureSocket.once('secureConnect', () => resolve());
      secureSocket.once('error', reject);
    });
    await command(secureSocket, `EHLO ${config.email.host}`);
    return secureSocket;
  }

  return socket;
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  if (!isConfigured()) {
    logger.info('Email delivery not configured; skipping outbound email', {
      to: message.to,
      subject: message.subject,
    });
    return false;
  }

  let socket: net.Socket | tls.TLSSocket | null = null;

  try {
    socket = await connect();

    if (config.email.user && config.email.password) {
      const auth = encodeBase64(`\0${config.email.user}\0${config.email.password}`);
      await command(socket, `AUTH PLAIN ${auth}`);
    }

    await command(socket, `MAIL FROM:<${mailboxFromAddress(config.email.from)}>`);
    await command(socket, `RCPT TO:<${message.to}>`);
    await command(socket, 'DATA');

    const payload = [
      `From: ${escapeHeader(config.email.from)}`,
      `To: ${escapeHeader(message.to)}`,
      `Subject: ${escapeHeader(message.subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      message.text.replace(/\r?\n/g, '\r\n'),
      '.',
      '',
    ].join('\r\n');

    socket.write(payload);
    await readResponse(socket);
    await command(socket, 'QUIT');
    return true;
  } catch (err) {
    logger.error('Failed to send email', {
      to: message.to,
      error: err instanceof Error ? err.message : 'Unknown email error',
    });
    return false;
  } finally {
    socket?.end();
  }
}

export function canExposeDevelopmentCode(): boolean {
  return !config.isProd() && !isConfigured();
}
