import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import ThemeToggle from '../components/ThemeToggle';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const d = await res.json();
    if (d.ok) {
      router.push('/dashboard');
    } else {
      setError('Invalid username or password.');
    }
  }

  return (
    <div className="login-page">
      <Head>
        <title>Login — License Admin</title>
      </Head>
      <ThemeToggle floating />
      <form className="login-box" onSubmit={handleSubmit}>
        <span className="brand-mark">◆</span>
        <h2>License Admin</h2>
        {error && <p className="error">{error}</p>}
        <label>Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
          autoComplete="username"
        />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <button type="submit" className="btn-primary btn-block">
          Log In
        </button>
      </form>
    </div>
  );
}
