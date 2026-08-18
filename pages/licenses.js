import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import CopyChip from '../components/CopyChip';
import ActionMenu from '../components/ActionMenu';
import { requireAdminSSR } from '../lib/requireAdminSSR';

export async function getServerSideProps(context) {
  return requireAdminSSR(context);
}

function timeLeftLabel(expiresAt) {
  if (!expiresAt) return { text: 'Lifetime', tone: 'lifetime' };
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return { text: 'Expired', tone: 'expired' };

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const tone = diffMs < 24 * 3600 * 1000 ? 'soon' : 'ok';

  if (days > 0) return { text: `${days}d ${hours}h left`, tone };
  if (hours > 0) return { text: `${hours}h ${minutes}m left`, tone };
  return { text: `${minutes}m left`, tone };
}

const TONE_BADGE_CLASS = {
  ok: 'badge-active',
  soon: 'badge-soon',
  expired: 'badge-expired',
  lifetime: 'badge-lifetime',
};

const TABS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['trial', 'Trial'],
  ['expired', 'Expired'],
  ['revoked', 'Revoked'],
];

function ExtendByDays({ onExtend }) {
  const [days, setDays] = useState('');
  return (
    <div className="date-row">
      <input
        type="number"
        min="1"
        placeholder="Days"
        value={days}
        onChange={(e) => setDays(e.target.value)}
        style={{ width: '70px' }}
      />
      <button
        type="button"
        className="btn-sm"
        onClick={() => {
          const n = parseInt(days, 10);
          if (n > 0) onExtend(n);
        }}
      >
        Extend
      </button>
    </div>
  );
}

export default function Licenses({ username }) {
  const [licenses, setLicenses] = useState([]);
  const [counts, setCounts] = useState({ total: 0, active: 0, revoked: 0, expired: 0, trial: 0 });
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [activeMenu, setActiveMenu] = useState({ id: null, anchor: null });
  const [genOpen, setGenOpen] = useState(false);
  const [genName, setGenName] = useState('');
  const [genDays, setGenDays] = useState('');
  const [genType, setGenType] = useState('paid');
  const [createdKey, setCreatedKey] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (search) params.set('q', search);
    const res = await fetch(`/api/admin/licenses?${params.toString()}`);
    const d = await res.json();
    if (d.ok) {
      setLicenses(d.licenses);
      setCounts(d.counts);
    }
  }, [status, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (!e.target.closest || !e.target.closest('.action-cell')) {
        setActiveMenu({ id: null, anchor: null });
      }
    }
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  async function handleGenerate(e) {
    e.preventDefault();
    const res = await fetch('/api/admin/licenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: genName, days: genDays, type: genType }),
    });
    const d = await res.json();
    if (d.ok) {
      setCreatedKey(d.key);
      setGenName('');
      setGenDays('');
      setGenType('paid');
      setGenOpen(false);
      load();
    }
  }

  async function rowAction(id, action, extra) {
    setActiveMenu({ id: null, anchor: null });
    await fetch(`/api/admin/licenses/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(extra || {}) }),
    });
    load();
  }

  async function bulkAction(action) {
    if (selected.size === 0) return;
    const confirmMsg =
      action === 'delete'
        ? 'Permanently delete all selected licenses? This cannot be undone.'
        : 'End trial and require a paid key for all selected licenses?';
    if (!confirm(confirmMsg)) return;
    await fetch('/api/admin/licenses/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulk_action: action, ids: Array.from(selected) }),
    });
    setSelected(new Set());
    load();
  }

  function toggleSelectAll(checked) {
    setSelected(checked ? new Set(licenses.map((l) => l.id)) : new Set());
  }

  function toggleRow(id, checked) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const allSelected = licenses.length > 0 && selected.size === licenses.length;

  return (
    <Layout title="Licenses" active="keys" username={username}>
      <Head>
        <title>Licenses — License Admin</title>
      </Head>

      {createdKey && (
        <div className="panel">
          <p className="success">
            ✓ New key created: <CopyChip value={createdKey} />
          </p>
        </div>
      )}

      <div className="tabs">
        {TABS.map(([key, label]) => (
          <a
            key={key}
            href="#"
            className={status === key ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              setStatus(key);
            }}
          >
            {label} ({counts[key === 'all' ? 'total' : key]})
          </a>
        ))}
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
          placeholder="Search key / name / HWID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="btn-sm">
          Search
        </button>
      </form>

      <details className="panel gen-panel" open={genOpen} onToggle={(e) => setGenOpen(e.target.open)}>
        <summary>Generate new license key</summary>
        <form onSubmit={handleGenerate}>
          <div className="field-row">
            <label>Type</label>
            <select value={genType} onChange={(e) => setGenType(e.target.value)}>
              <option value="paid">Paid</option>
              <option value="trial">Trial</option>
            </select>
          </div>
          <div className="field-row">
            <label>Customer name</label>
            <input type="text" value={genName} onChange={(e) => setGenName(e.target.value)} placeholder="Name" />
          </div>
          <div className="field-row">
            <label>Validity (days — leave blank for lifetime)</label>
            <input
              type="number"
              min="1"
              value={genDays}
              onChange={(e) => setGenDays(e.target.value)}
              placeholder="e.g. 30"
            />
          </div>
          <button type="submit" className="btn-primary">
            Generate
          </button>
        </form>
      </details>

      <div className="bulk-bar">
        <span className="bulk-count">{selected.size} selected</span>
        <button
          type="button"
          className="btn-sm bulk-btn"
          disabled={selected.size === 0}
          onClick={() => bulkAction('force_paid')}
        >
          ⛔ End Trial (Force Paid)
        </button>
        <button
          type="button"
          className="btn-sm btn-danger bulk-btn"
          disabled={selected.size === 0}
          onClick={() => bulkAction('delete')}
        >
          🗑 Delete Selected
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allSelected} onChange={(e) => toggleSelectAll(e.target.checked)} />
              </th>
              <th>Key</th>
              <th>Name</th>
              <th>Type</th>
              <th>HWID</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Time Left</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {licenses.map((lic) => {
              const tl = timeLeftLabel(lic.expires_at);
              return (
                <tr key={lic.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(lic.id)}
                      onChange={(e) => toggleRow(lic.id, e.target.checked)}
                    />
                  </td>
                  <td>
                    <CopyChip value={lic.license_key} />
                  </td>
                  <td>{lic.customer_name}</td>
                  <td>
                    {lic.is_trial ? (
                      <span className="badge badge-trial">Trial</span>
                    ) : (
                      <span className="badge badge-paid">Paid</span>
                    )}
                  </td>
                  <td className="mono wrap">{lic.hwid || '—'}</td>
                  <td>
                    <span className={`badge badge-${lic.status}`}>{lic.status}</span>
                  </td>
                  <td>{lic.expires_at || 'Lifetime'}</td>
                  <td>
                    <span className={`badge ${TONE_BADGE_CLASS[tl.tone]}`}>{tl.text}</span>
                  </td>
                  <td className="action-cell">
                    <button
                      type="button"
                      className="menu-btn"
                      onClick={(e) =>
                        setActiveMenu(activeMenu.id === lic.id ? { id: null, anchor: null } : { id: lic.id, anchor: e.currentTarget })
                      }
                    >
                      ⋮
                    </button>
                    <ActionMenu
                      isOpen={activeMenu.id === lic.id}
                      onClose={() => setActiveMenu({ id: null, anchor: null })}
                      anchorEl={activeMenu.anchor}
                    >
                        {lic.is_trial && lic.status === 'active' && (
                          <>
                            <div className="menu-section-label">Trial</div>
                            <button
                              className="force-item"
                              onClick={() => {
                                if (confirm('End this trial and force this device to a paid key?')) {
                                  rowAction(lic.id, 'force_paid');
                                }
                              }}
                            >
                              ⛔ End trial, require paid key
                            </button>
                            <div className="divider"></div>
                          </>
                        )}

                        <div className="menu-section-label">Device</div>
                        <button
                          onClick={() => {
                            if (confirm('Reset HWID for this key?')) rowAction(lic.id, 'reset_hwid');
                          }}
                        >
                          ↺ Reset HWID
                        </button>

                        <div className="menu-section-label">Status</div>
                        {lic.status === 'active' ? (
                          <button
                            onClick={() => {
                              if (confirm('Revoke this key?')) rowAction(lic.id, 'revoke');
                            }}
                          >
                            ⛒ Revoke
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (confirm('Reactivate this key?')) rowAction(lic.id, 'reactivate');
                            }}
                          >
                            ✓ Reactivate
                          </button>
                        )}

                        <div className="menu-section-label">Expiry</div>
                        <button
                          onClick={() => {
                            if (confirm('Extend by 30 days?')) rowAction(lic.id, 'extend_30');
                          }}
                        >
                          +30 days
                        </button>
                        <ExtendByDays onExtend={(days) => rowAction(lic.id, 'extend_days', { days })} />
                        <button
                          onClick={() => {
                            if (confirm('Make this key lifetime?')) rowAction(lic.id, 'set_lifetime');
                          }}
                        >
                          ∞ Lifetime
                        </button>

                        <div className="divider"></div>
                        <button
                          className="danger-item"
                          onClick={() => {
                            if (confirm('Delete permanently? This cannot be undone.')) rowAction(lic.id, 'delete');
                          }}
                        >
                          🗑 Delete
                        </button>
                    </ActionMenu>
                  </td>
                </tr>
              );
            })}
            {licenses.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-state">
                  No licenses found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
