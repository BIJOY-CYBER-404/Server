import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { requireAdminSSR } from '../lib/requireAdminSSR';

export async function getServerSideProps(context) {
  return requireAdminSSR(context);
}

const SCOPE_LABELS = {
  admins: 'Admin accounts',
  licenses: 'Licenses',
  trials: 'Trial-blocked devices',
  logs: 'Activity logs',
};
const SCOPES = ['admins', 'licenses', 'trials', 'logs'];

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Settings({ username }) {
  // --- System controls ---
  const [maintenance, setMaintenance] = useState(false);
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [controlsLoaded, setControlsLoaded] = useState(false);

  // --- Admin accounts ---
  const [admins, setAdmins] = useState([]);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  // --- My account ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [accountMsg, setAccountMsg] = useState('');
  const [accountOk, setAccountOk] = useState(false);
  const [displayUsername, setDisplayUsername] = useState(username);

  // --- Backup / restore ---
  const [backupBusy, setBackupBusy] = useState('');
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreAvailable, setRestoreAvailable] = useState([]);
  const [restoreSelected, setRestoreSelected] = useState(new Set());
  const [restoreMsg, setRestoreMsg] = useState('');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const fileInputRef = useRef(null);

  // --- Activity log ---
  const [logs, setLogs] = useState([]);

  const loadAdmins = useCallback(async () => {
    const res = await fetch('/api/admin/admins', { credentials: 'same-origin' });
    const d = await res.json();
    if (d.ok) setAdmins(d.admins);
  }, []);

  const loadLogs = useCallback(async () => {
    const res = await fetch('/api/admin/logs?limit=30', { credentials: 'same-origin' });
    const d = await res.json();
    if (d.ok) setLogs(d.logs);
  }, []);

  useEffect(() => {
    fetch('/api/admin/settings', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setMaintenance(d.maintenance);
          setTrialEnabled(d.trial_enabled);
        }
        setControlsLoaded(true);
      });
    loadAdmins();
    loadLogs();
  }, [loadAdmins, loadLogs]);

  async function toggleMaintenance() {
    const next = !maintenance;
    setMaintenance(next);
    await fetch('/api/admin/settings', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form: 'maintenance', maintenance: next }),
    });
    loadLogs();
  }

  async function toggleTrial() {
    const next = !trialEnabled;
    setTrialEnabled(next);
    await fetch('/api/admin/settings', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form: 'trial', trial_enabled: next }),
    });
    loadLogs();
  }

  async function handleAddAdmin(e) {
    e.preventDefault();
    setAdminError('');
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newAdminUsername, password: newAdminPassword }),
    });
    const d = await res.json();
    if (d.ok) {
      setNewAdminUsername('');
      setNewAdminPassword('');
      loadAdmins();
      loadLogs();
    } else {
      setAdminError(d.error === 'username_taken' ? 'That username is already taken.' : 'Failed to create admin.');
    }
  }

  async function handleRemoveAdmin(id) {
    if (!confirm('Remove this admin account?')) return;
    await fetch(`/api/admin/admins?id=${id}`, { method: 'DELETE', credentials: 'same-origin' });
    loadAdmins();
    loadLogs();
  }

  async function handleAccountUpdate(e) {
    e.preventDefault();
    setAccountMsg('');
    setAccountOk(false);
    const res = await fetch('/api/admin/account', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_password: currentPassword,
        new_username: newUsername || undefined,
        new_password: newPassword || undefined,
      }),
    });
    const d = await res.json();
    if (d.ok) {
      setAccountOk(true);
      setAccountMsg('Account updated.');
      setDisplayUsername(d.username);
      setCurrentPassword('');
      setNewUsername('');
      setNewPassword('');
      loadAdmins();
      loadLogs();
    } else {
      const messages = {
        wrong_current_password: 'Current password is incorrect.',
        username_taken: 'That username is already taken.',
        password_too_short: 'New password must be at least 8 characters.',
        nothing_to_update: 'Enter a new username or password to change.',
      };
      setAccountMsg(messages[d.error] || 'Failed to update account.');
    }
  }

  async function handleBackup(scope) {
    setBackupBusy(scope);
    try {
      const res = await fetch(`/api/admin/backup?scope=${scope}`, { credentials: 'same-origin' });
      const d = await res.json();
      if (d.ok) {
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        downloadJson(d.backup, `license-backup-${scope}-${stamp}.json`);
        loadLogs();
      }
    } finally {
      setBackupBusy('');
    }
  }

  function handleFileChosen(e) {
    const file = e.target.files?.[0];
    setRestoreMsg('');
    setRestoreFile(null);
    setRestoreAvailable([]);
    setRestoreSelected(new Set());
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const available = SCOPES.filter((s) => parsed?.data?.[s]);
        if (!available.length) {
          setRestoreMsg('This file has no recognizable backup data in it.');
          return;
        }
        setRestoreFile(parsed);
        setRestoreAvailable(available);
        setRestoreSelected(new Set(available));
      } catch (err) {
        setRestoreMsg('Could not read that file — is it a backup JSON file from this panel?');
      }
    };
    reader.readAsText(file);
  }

  function toggleRestoreScope(scope) {
    setRestoreSelected((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }

  async function handleRestore() {
    if (!restoreFile || restoreSelected.size === 0) return;
    const scopeList = Array.from(restoreSelected).map((s) => SCOPE_LABELS[s]).join(', ');
    if (
      !confirm(
        `Restore ${scopeList} from this backup?\n\nExisting rows are merged/updated by their key (username / license key / HWID) — nothing currently in the database gets deleted, but matching rows will be overwritten with the backup's data.`
      )
    ) {
      return;
    }
    setRestoreBusy(true);
    setRestoreMsg('');
    try {
      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: restoreFile, scope: Array.from(restoreSelected).join(',') }),
      });
      const d = await res.json();
      if (d.ok) {
        const summary = Object.entries(d.restored)
          .map(([k, v]) => `${SCOPE_LABELS[k] || k}: ${v}`)
          .join(', ');
        setRestoreMsg(`✓ Restored — ${summary}`);
        setRestoreFile(null);
        setRestoreAvailable([]);
        setRestoreSelected(new Set());
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadAdmins();
        loadLogs();
      } else {
        setRestoreMsg('Restore failed — the file may be malformed.');
      }
    } finally {
      setRestoreBusy(false);
    }
  }

  return (
    <Layout title="Settings" active="settings" username={displayUsername}>
      <Head>
        <title>Settings — License Admin</title>
      </Head>

      <h2>System Controls</h2>

      <div className="panel">
        <div className="panel-row">
          <label className="switch">
            <input type="checkbox" checked={maintenance} onChange={toggleMaintenance} disabled={!controlsLoaded} />
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
            <input type="checkbox" checked={trialEnabled} onChange={toggleTrial} disabled={!controlsLoaded} />
            <span className="track"></span>
            <span className="switch-label">Allow new devices to auto-get a free trial</span>
          </label>
        </div>
        <p className="hint">
          Off = new devices go straight to &quot;enter a license key&quot; — no auto-trial. Trial keys already
          issued keep working until they expire.
        </p>
      </div>

      <h2>My Account</h2>

      <div className="panel">
        <p className="hint">Signed in as <strong>{displayUsername}</strong>. Changing your password here signs out any other device using this session.</p>
        <form onSubmit={handleAccountUpdate}>
          {accountMsg && <p className={accountOk ? 'success' : 'error'}>{accountMsg}</p>}
          <div className="field-row">
            <label>Current password (required)</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="field-row">
            <label>New username (optional)</label>
            <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder={displayUsername} />
          </div>
          <div className="field-row">
            <label>New password (optional, min 8 characters)</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn-primary">
            Update Account
          </button>
        </form>
      </div>

      <h2>Admin Accounts</h2>

      <div className="panel">
        <table style={{ marginBottom: '16px' }}>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.username}</td>
                <td className="hint">{a.created_at ? a.created_at.slice(0, 10) : ''}</td>
                <td style={{ textAlign: 'right' }}>
                  {a.username !== displayUsername && (
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
            <input type="text" value={newAdminUsername} onChange={(e) => setNewAdminUsername(e.target.value)} required />
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
      </div>

      <h2>Backup &amp; Restore</h2>

      <div className="panel">
        <p className="hint">
          Back up admin accounts, licenses, trial-blocked devices, and the activity log — all at once, or one at a
          time. Admin-account backups include each account&apos;s password hash (not the plain password, but still
          sensitive) — store the downloaded file somewhere private.
        </p>
        <div className="backup-grid">
          <button type="button" className="btn-primary" disabled={!!backupBusy} onClick={() => handleBackup('all')}>
            {backupBusy === 'all' ? 'Preparing…' : '⬇ Backup Everything'}
          </button>
          {SCOPES.map((s) => (
            <button key={s} type="button" className="btn-sm btn-ghost" disabled={!!backupBusy} onClick={() => handleBackup(s)}>
              {backupBusy === s ? 'Preparing…' : `⬇ ${SCOPE_LABELS[s]}`}
            </button>
          ))}
        </div>

        <div className="divider" style={{ margin: '18px 0' }}></div>

        <p className="hint">
          Restore from a backup file. Existing rows are matched by username / license key / HWID and updated —
          nothing already in the database is deleted, even if you restore &quot;Everything&quot;.
        </p>
        <input type="file" accept="application/json" ref={fileInputRef} onChange={handleFileChosen} />

        {restoreAvailable.length > 0 && (
          <div style={{ marginTop: '14px' }}>
            <p className="hint">This file contains:</p>
            <div className="restore-scopes">
              {restoreAvailable.map((s) => (
                <label key={s} className="checkbox-row">
                  <input type="checkbox" checked={restoreSelected.has(s)} onChange={() => toggleRestoreScope(s)} />
                  {SCOPE_LABELS[s]}
                </label>
              ))}
            </div>
            <button type="button" className="btn-primary" disabled={restoreBusy || restoreSelected.size === 0} onClick={handleRestore}>
              {restoreBusy ? 'Restoring…' : 'Restore Selected'}
            </button>
          </div>
        )}
        {restoreMsg && <p className={restoreMsg.startsWith('✓') ? 'success' : 'error'} style={{ marginTop: '10px' }}>{restoreMsg}</p>}
      </div>

      <h2>Recent Activity</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Admin</th>
              <th>Details</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.action.replace(/_/g, ' ')}</td>
                <td>{log.admin_username || '—'}</td>
                <td className="mono wrap hint">{log.details ? JSON.stringify(log.details) : ''}</td>
                <td className="hint">{log.created_at ? new Date(log.created_at).toLocaleString() : ''}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-state">
                  No activity recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
