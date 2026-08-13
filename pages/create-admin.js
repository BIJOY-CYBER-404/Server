import { useState } from 'react';
import Head from 'next/head';
import ThemeToggle from '../components/ThemeToggle';

export default function CreateAdmin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    const res = await fetch('/api/admin/create-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Setup-Token': setupToken },
      body: JSON.stringify({ username, password }),
    });
    const d = await res.json();
    if (d.ok) {
      setOk(true);
      setMessage(`Admin '${username}' created. You can now log in.`);
    } else {
      setMessage(`Failed: ${d.error || 'unknown error'}`);
    }
  }

  return (
    <div className="login-page">
      <Head>
        <title>Create Admin — License Admin</title>
      </Head>
      <ThemeToggle floating />
      <form className="login-box" onSubmit={handleSubmit}>
        <span className="brand-mark">◆</span>
        <h2>Create First Admin</h2>
        {message && <p className={ok ? 'success' : 'error'}>{message}</p>}
        {!ok ? (
          <>
            <label>Setup token</label>
            <input
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              required
              placeholder="ADMIN_SETUP_TOKEN from your Vercel env vars"
            />
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <button type="submit" className="btn-primary btn-block">
              Create
            </button>
          </>
        ) : (
          <a href="/login" className="btn btn-primary btn-block" style={{ textAlign: 'center' }}>
            Go to Login →
          </a>
        )}
      </form>
    </div>
  );
}
