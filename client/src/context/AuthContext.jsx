import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, if a token exists, fetch the current user.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }

  // Returns { needsVerification: true, email } when the server wants the emailed code
  // first; otherwise the new user is logged in straight away.
  async function register(data) {
    const res = await api.post('/auth/register', data);
    if (res.data.needsVerification) return res.data;
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data;
  }

  // Confirms the emailed 6-digit code and logs the person in.
  async function verifyEmail(email, code) {
    const res = await api.post('/auth/verify-email', { email, code });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }

  async function resendCode(email) {
    const res = await api.post('/auth/resend-code', { email });
    return res.data;
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  const value = { user, loading, login, register, verifyEmail, resendCode, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
