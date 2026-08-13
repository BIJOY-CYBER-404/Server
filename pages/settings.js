import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { requireAdminSSR } from '../lib/requireAdminSSR';

export async function getServerSideProps(context) {
  return requireAdminSSR(context);
}

export default function Settings({ username }) {
  const [maintenance, setMaintenance] = useState(false);
  const [trialEnabled, setTrialEnabled] = useState(true);

  const [admins, setAdmins] = useState([]);
  const [currentUsername, setCurrentUsername] = useState(username);

  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [accountUsername, setAccountUsername] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState(false);

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/admin/settings');
    const d = await res.json();
    if (d.ok) {
      setMaintenance(d.maintenance);
      setTrialEnabled(d.trial_enabled);
    }
  }, []);

  const loadAdmins = useCallback(async () => {
    const res = await fetch('/api/admin/admins');
    const d = await res.json();
    if (d.ok) setAdmins(d.admins);
  }, []);

  useEffect(() => {
    loadSettings();
    loadAdmins();
  }, [loadSettings, loadAdmins]);

  async function toggleMaintenance() {
    const next = !maintenance;
    setMaintenance(next);
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form: 'maintenance', maintenance: next }),
    });
  }

  async function toggleTrial() {
    const next = !trialEnabled;
    setTrialEnabled(next);
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form: 'trial', trial_enabled: next }),
    });
  }

  async function handleAddAdmin(e) {
    e.preventDefault();
    setAdminError('');
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newAdminUsername, password: newAdminPassword }),
    });
    const d = await res.json();
    if (d.ok) {
      setNewAdminUsername('');
      setNewAdminPassword('');
      loadAdmins();
    } else {
      setAdminError(d.error === 'username_taken' ? 'That username is already taken.' : 'Failed to create admin.');
    }
  }

  async function handleRemoveAdmin(id) {
    if (!confirm('Remove this admin account?')) return;
    await fetch(`/api/admin/admins?id=${id}`, { method: 'DELETE' });
    loadAdmins();
  }

  async function handleUpdateAccount(e) {
    e.preventDefault();
    setAccountMessage('');
    const res = await fetch('/api/admin/admins', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_password: currentPassword,
        username: accountUsername,
        password: accountPassword,
      }),
    });
    const d = await res.json();
    if (d.ok) {
      setAccountError(false);
      setAccountMessage('Your account was updated.');
      setCurrentUsername(d.username);
      setCurrentPassword('');
      setAccountUsername('');
      setAccountPassword('');
      loadAdmins();
    } else {
      setAccountError(true);
      const messages = {
        wrong_current_password: 'Current password is incorrect.',
        password_too_short: 'New password must be at least 8 characters.',
        username_taken: 'That username is already taken.',
      };
      setAccountMessage(messages[d.error] || 'Could not update account.');
    }
  }

  return (
    <Layout title="Settings" active="settings" username={currentUsername}>
      <Head>
        <title>Settings — License Admin</title>
      </Head>

      <h2>System Controls</h2>

      <div className="panel">
        <div className="panel-row">
          <label className="switch">
            <input type="checkbox" checked={maintenance} onChange={toggleMaintenance} />
            <span className="track"></span>
            <span className="switch-label">Maintenance mode — block all clients</span>
          </label>
        </div>
        <p className="hint">
          When on, every client sees the maintenance message on its next launch — without you touching any keys.
        </p>
      </div>

      <div className="panel">
        <div className="panel-row">
          <label className="switch">
            <input type="checkbox" checked={trialEnabled} onChange={toggleTrial} />
            <span className="track"></span>
            <span className="switch-label">Allow new devices to auto-get a free trial</span>
          </label>
        </div>
        <p className="hint">
          Off = new devices go straight to &quot;enter a license key&quot; — no auto-trial. Trial keys already
          issued keep working until they expire.
        </p>
      </div>

      <h2>Admin Accounts</h2>

      <div className="panel">
        <table>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.username}</td>
                <td className="hint">{a.created_at ? a.created_at.slice(0, 10) : ''}</td>
                <td style={{ textAlign: 'right' }}>
                  {a.username === currentUsername ? (
                    <span className="hint">(you)</span>
                  ) : (
                    <button type="button" className="btn-sm btn-danger" onClick={() => handleRemoveAdmin(a.id)}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="panel gen-panel">
        <summary>Add new admin</summary>
        <form onSubmit={handleAddAdmin}>
          {adminError && <p className="error">{adminError}</p>}
          <div className="field-row">
            <label>Username</label>
            <input
              type="text"
              value={newAdminUsername}
              onChange={(e) => setNewAdminUsername(e.target.value)}
              required
            />
          </div>
          <div className="field-row">
            <label>Password (min 8 characters)</label>
            <input
              type="password"
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <button type="submit" className="btn-primary">
            Add Admin
          </button>
        </form>
      </details>

      <details className="panel gen-panel">
        <summary>Update my account</summary>
        <form onSubmit={handleUpdateAccount}>
          {accountMessage && <p className={accountError ? 'error' : 'success'}>{accountMessage}</p>}
          <div className="field-row">
            <label>Current password (required to confirm any change)</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="field-row">
            <label>New username (leave blank to keep &quot;{currentUsername}&quot;)</label>
            <input type="text" value={accountUsername} onChange={(e) => setAccountUsername(e.target.value)} />
          </div>
          <div className="field-row">
            <label>New password (leave blank to keep current password)</label>
            <input
              type="password"
              value={accountPassword}
              onChange={(e) => setAccountPassword(e.target.value)}
              minLength={8}
            />
          </div>
          <button type="submit" className="btn-primary">
            Update Account
          </button>
        </form>
      </details>
    </Layout>
  );
}
