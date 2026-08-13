import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import CopyChip from '../components/CopyChip';
import { requireAdminSSR } from '../lib/requireAdminSSR';

export async function getServerSideProps(context) {
  return requireAdminSSR(context);
}

export default function Dashboard({ username }) {
  const [counts, setCounts] = useState({ total: 0, active: 0, trial: 0, expired: 0 });
  const [recent, setRecent] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setCounts(d.counts);
          setRecent(d.recent);
        }
        setLoaded(true);
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

      <h2>Generated in the last 24 hours ({recent.length})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Type</th>
              <th>Created</th>
              <th>Expires</th>
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
                <td>{lic.created_at}</td>
                <td>{lic.expires_at || 'Lifetime'}</td>
              </tr>
            ))}
            {loaded && recent.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  No licenses generated in the last 24 hours.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p>
        <a href="/licenses">Manage Licenses →</a> &nbsp;·&nbsp; <a href="/trials">Manage Trial-Blocked Devices →</a>{' '}
        &nbsp;·&nbsp; <a href="/settings">Settings →</a>
      </p>
    </Layout>
  );
}
