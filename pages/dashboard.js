import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { requireAdminSSR } from '../lib/requireAdminSSR';

export async function getServerSideProps(context) {
  return requireAdminSSR(context);
}

export default function Dashboard({ username }) {
  const [counts, setCounts] = useState({ total: 0, active: 0, trial: 0, expired: 0 });
  const [maintenance, setMaintenance] = useState(false);
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const [admins, setAdmins] = useState([]);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  const loadAdmins = useCallback(async () => {
    const res = await fetch('/api/admin/admins');
    const d = await res.json();
    if (d.ok) setAdmins(d.admins);
  }, []);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setCounts(d.counts);
          setMaintenance(d.maintenance);
          setTrialEnabled(d.trial_enabled);
        }
        setLoaded(true);
      });
    loadAdmins();
  }, [loadAdmins]);

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

  return (
    <Layout title="Dashboard" active="dashboard" username={username}>
      <Head>
        <title>Dashboard — License Admin</title>
      </Head>

      <div className="cards">
        <div className="card">
          <span className="num">{loaded ? counts.total : '—'}</span>
          <span className="label">Total Licenses</span>
        </div>
        <div className="card tone-green">
          <span className="num">{loaded ? counts.active : '—'}</span>
          <span className="label">Active</span>
        </div>
        <div className="card tone-blue">
          <span className="num">{loaded ? counts.trial : '—'}</span>
          <span className="label">Trials Issued</span>
        </div>
        <div className="card tone-red">
          <span className="num">{loaded ? counts.expired : '—'}</span>
          <span className="label">Expired</span>
        </div>
      </div>

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

      <details className="panel gen-panel" open={adminPanelOpen} onToggle={(e) => setAdminPanelOpen(e.target.open)}>
        <summary>Manage admin logins ({admins.length})</summary>

        <table style={{ marginTop: '12px', marginBottom: '16px' }}>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.username}</td>
                <td className="hint">{a.created_at ? a.created_at.slice(0, 10) : ''}</td>
                <td style={{ textAlign: 'right' }}>
                  {a.username !== username && (
                    <button type="button" className="btn-sm btn-danger" onClick={() => handleRemoveAdmin(a.id)}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form onSubmit={handleAddAdmin}>
          {adminError && <p className="error">{adminError}</p>}
          <div className="field-row">
            <label>New admin username</label>
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

      <p>
        <a href="/licenses">Manage Licenses →</a> &nbsp;·&nbsp; <a href="/trials">Manage Trial-Blocked Devices →</a>
      </p>
    </Layout>
  );
}
