import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { requireAdminSSR } from '../lib/requireAdminSSR';

export async function getServerSideProps(context) {
  return requireAdminSSR(context);
}

export default function Trials({ username }) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [blockOpen, setBlockOpen] = useState(false);
  const [hwid, setHwid] = useState('');
  const [note, setNote] = useState('');
  const [revokedMsg, setRevokedMsg] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    const res = await fetch(`/api/admin/trials?${params.toString()}`);
    const d = await res.json();
    if (d.ok) setRows(d.rows);
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleBlock(e) {
    e.preventDefault();
    if (!hwid.trim()) return;
    const res = await fetch('/api/admin/trials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'block', hwid, note }),
    });
    const d = await res.json();
    setRevokedMsg(d.ok && d.revoked > 0 ? `HWID blocked, and ${d.revoked} active license on that device revoked.` : '');
    setHwid('');
    setNote('');
    setBlockOpen(false);
    load();
  }

  async function handleUnblock(id) {
    if (!confirm('Allow this HWID to get a trial again?')) return;
    await fetch('/api/admin/trials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unblock', id }),
    });
    load();
  }

  return (
    <Layout title="Trials" active="trials" username={username}>
      <Head>
        <title>Trials — License Admin</title>
      </Head>

      {revokedMsg && (
        <div className="panel">
          <p className="success">✓ {revokedMsg}</p>
        </div>
      )}

      <div className="panel">
        <p className="hint">
          Every HWID here can never auto-receive another free trial — that&apos;s what guarantees one trial per
          device even if the app&apos;s local cache files are wiped. Blocking a HWID also revokes any license
          currently active for it, so the device is cut off immediately, not just next time it asks for a trial.
          Rows with a note were blocked manually by you rather than earned by an actual trial grant. Remove a row to
          let that HWID try again (this does not restore any license that was revoked).
        </p>
      </div>

      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input
          type="text"
          placeholder="Search HWID / note"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="btn-sm">
          Search
        </button>
      </form>

      <details className="panel gen-panel" open={blockOpen} onToggle={(e) => setBlockOpen(e.target.open)}>
        <summary>Block a HWID from trials (before it ever requests one)</summary>
        <form onSubmit={handleBlock}>
          <div className="field-row">
            <label>HWID</label>
            <input
              type="text"
              value={hwid}
              onChange={(e) => setHwid(e.target.value)}
              placeholder="Exact HWID string"
              required
            />
          </div>
          <div className="field-row">
            <label>Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. known emulator fingerprint"
            />
          </div>
          <button type="submit" className="btn-primary">
            Block
          </button>
        </form>
      </details>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>HWID</th>
              <th>Note</th>
              <th>Recorded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="mono wrap">{row.hwid}</td>
                <td>{row.note || '—'}</td>
                <td>{row.used_at}</td>
                <td className="action-cell">
                  <button type="button" className="btn-sm btn-ghost" onClick={() => handleUnblock(row.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-state">
                  No trial records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
