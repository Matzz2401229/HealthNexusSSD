import 'express-session';

export interface SessionUser {
  id: number;
  role: 'patient' | 'doctor' | 'pharmacist' | 'admin';
  status: 'pending' | 'active' | 'suspended';
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}