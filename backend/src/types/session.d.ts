import 'express-session';

export interface SessionUser {
  id: number;
  role: 'patient' | 'doctor' | 'pharmacist' | 'admin';
  status: 'pending' | 'active' | 'suspended';
  fullName?: string | null;
  /** Epoch ms when this session was created. Enforces the NFSR5 8h absolute
   *  timeout in middleware/auth.ts, independent of the rolling idle timeout. */
  loginAt: number;
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}
