import { createContext, useContext, useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';

/**
 * Auth state for the whole app. Wraps Adil's backend endpoints:
 *   - GET  /api/auth/me      → who am I (restores session on page load)
 *   - POST /api/auth/login   → sign in
 *   - POST /api/auth/logout  → sign out
 * The session itself lives in the server-side session + HttpOnly cookie; this
 * only mirrors "who's logged in" for the UI. Real access control is server-side.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until the /me check finishes

  // On first load, ask the server if there's a valid session → survives refresh.
  useEffect(() => {
    apiGet('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null)) // 401 = not logged in; that's fine
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await apiPost('/auth/login', { email, password });
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await apiPost('/auth/logout');
    setUser(null);
  }

  function updateUser(patch) {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
