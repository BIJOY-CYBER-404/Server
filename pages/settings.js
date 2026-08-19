import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { requireAdminSSR } from '../lib/requireAdminSSR';

export async function getServerSideProps(context) {
  return requireAdminSSR(context);
}

export default function Settings({ username, adminId }) {
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

  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreMessage, setRestoreMessage] = useState('');
  const [restoreError, setRestoreError] = useState(false);
  const [restoring, setRestoring] = useState(false);

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

  const me = admins.find((a) => a.id === adminId);
  const isPrimary = !!me?.is_primary;

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
      const messages = {
        username_taken: 'That username is already taken.',
        primary_only: 'Only the primary admin can add new admin accounts.',
      };
      setAdminError(messages[d.error] || 'Failed to create admin.');
    }
  }

  async function handleRemoveAdmin(id) {
    if (!confirm('Remove this admin account?')) return;
    const res = await fetch(`/api/admin/admins?id=${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (!d.ok) {
      const messages = {
        primary_only: 'Only the primary admin can remove admin accounts.',
        cannot_delete_primary: "The primary admin account can't be removed.",
        cannot_delete_self: "You can't remove your own account while logged in as it.",
      };
      alert(messages[d.error] || 'Could not remove that admin.');
    }
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

  async function handleRestore(e) {
    e.preventDefault();
    if (!restoreFile) return;
    if (!confirm('Restore from this backup? Matching records will be updated; nothing will be deleted.')) return;

    setRestoring(true);
    setRestoreMessage('');
    try {
      const text = await restoreFile.text();
      const parsed = JSON.parse(text);
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const d = await res.json();
      if (d.ok) {
        setRestoreError(false);
        const parts = Object.entries(d.summary || {}).map(([k, v]) => `${v} ${k.replace('_', ' ')}`);
        setRestoreMessage(parts.length ? `Restored: ${parts.join(', ')}.` : 'That backup file did not contain any recognized data.');
      } else {
        setRestoreError(true);
        setRestoreMessage(d.error === 'invalid_backup_file' ? "This doesn't look like a valid backup file." : 'Restore failed.');
      }
    } catch (err) {
      setRestoreError(true);
      setRestoreMessage("Could not read that file — make sure it's a valid JSON backup.");
    } finally {
      setRestoring(false);
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
        <div className="table-wrap table-wrap-compact">
          <table>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.username} {a.is_primary && <span className="badge badge-primary">Primary</span>}
                  </td>
                  <td className="hint">{a.created_at ? a.created_at.slice(0, 10) : ''}</td>
                  <td style={{ textAlign: 'right' }}>
                    {a.id === adminId ? (
                      <span className="hint">(you)</span>
                    ) : a.is_primary || !isPrimary ? (
                      <span className="hint">—</span>
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
        {!isPrimary && (
          <p className="hint" style={{ marginTop: '10px' }}>
            Only the primary admin can add, remove, or edit other admin accounts. You can still update your own
            account below.
          </p>
        )}
      </div>

      {isPrimary && (
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
      )}

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

      <h2>Backup &amp; Restore</h2>

      <div className="panel">
        <p className="hint">
          Downloads a JSON file. The Admin Accounts backup includes password
          hashes (bcrypt, not plaintext passwords — but still sensitive
          data, keep the file private). Back up everything at once, or just
          one category if that&apos;s all you need.
        </p>
        <div className="panel-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
          {isPrimary && (
            <>
              <a href="/api/admin/backup?type=full" className="btn btn-primary">
                ⬇ Full Backup (everything)
              </a>
              <a href="/api/admin/backup?type=admins" className="btn btn-sm">
                Admin Accounts
              </a>
            </>
          )}
          <a href="/api/admin/backup?type=licenses" className="btn btn-sm">
            Licenses
          </a>
          <a href="/api/admin/backup?type=trials" className="btn btn-sm">
            Trials
          </a>
          <a href="/api/admin/backup?type=settings" className="btn btn-sm">
            Settings
          </a>
        </div>
        {!isPrimary && (
          <p className="hint" style={{ marginTop: '8px' }}>
            Full backup and Admin Accounts export are only available to the primary admin, since they include other
            admins&apos; password hashes.
          </p>
        )}
      </div>

      <div className="panel">
        <p className="hint">
          Restoring <strong>merges</strong> into what&apos;s already here — records matching by license key / HWID /
          username / setting name get updated, new ones get added. Nothing already in the database is deleted.
          Works with a full backup file or any single-category one.
        </p>
        {restoreMessage && <p className={restoreError ? 'error' : 'success'}>{restoreMessage}</p>}
        <form onSubmit={handleRestore}>
          <div className="field-row">
            <label>Backup file (.json)</label>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={restoring}>
            {restoring ? 'Restoring…' : 'Restore'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
