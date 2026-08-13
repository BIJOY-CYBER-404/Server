import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Layout from '../components/Layout';
import CopyChip from '../components/CopyChip';
import { requireAdminSSR } from '../lib/requireAdminSSR';

export async function getServerSideProps(context) {
  return requireAdminSSR(context);
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Dashboard({ username }) {
  const [counts, setCounts] = useState({ total: 0, active: 0, trial: 0, expired: 0 });
  const [loaded, setLoaded] = useState(false);
  const [recent, setRecent] = useState([]);
  const [recentLoaded, setRecentLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setCounts(d.counts);
        setLoaded(true);
      });

    fetch('/api/admin/licenses/recent', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setRecent(d.licenses);
        setRecentLoaded(true);
      });
  }, []);

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

      <h2>Last 24 Hours — Generated License Keys</h2>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Type</th>
              <th>Validity</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((lic) => (
              <tr key={lic.id}>
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
                <td>{lic.expires_at ? new Date(lic.expires_at).toISOString().slice(0, 10) : 'Lifetime'}</td>
                <td className="hint">{timeAgo(lic.created_at)}</td>
              </tr>
            ))}
            {recentLoaded && recent.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  No license keys generated in the last 24 hours.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p>
        <Link href="/licenses">Manage Licenses →</Link> &nbsp;·&nbsp; <Link href="/trials">Manage Trial-Blocked Devices →</Link>{' '}
        &nbsp;·&nbsp; <Link href="/settings">System Controls &amp; Admin Accounts →</Link>
      </p>
    </Layout>
  );
}
