import { useEffect, useState } from 'react';
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
  }, []);

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

      <p>
        <a href="/licenses">Manage Licenses →</a> &nbsp;·&nbsp; <a href="/trials">Manage Trial-Blocked Devices →</a>
      </p>
    </Layout>
  );
}
