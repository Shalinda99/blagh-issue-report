import { useState } from 'react';
import { Settings2, RefreshCw, Trash2, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { useAdminConfig, useAdminStats } from '@/hooks/useHealth';
import { seedData, resetDatabase } from '@/api/admin';
import { saveCredentials } from '@/api/client';
import { useQueryClient } from '@tanstack/react-query';

export function Settings() {
  const { data: config, isLoading: loadingConfig } = useAdminConfig();
  const { data: stats } = useAdminStats();
  const qc = useQueryClient();

  const [seedCount, setSeedCount] = useState(100);
  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [username, setUsername] = useState('mock_user');
  const [password, setPassword] = useState('change_me');

  async function handleSeed() {
    setSeeding(true);
    try {
      const r = await seedData(seedCount);
      toast.success(`Seeded ${r.seeded} events`);
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      qc.invalidateQueries({ queryKey: ['events'] });
    } catch {
      toast.error('Seed failed');
    } finally {
      setSeeding(false);
    }
  }

  async function handleReset() {
    if (!confirm('Drop all data and reseed? This cannot be undone.')) return;
    setResetting(true);
    try {
      await resetDatabase(seedCount);
      toast.success('Database reset and reseeded');
      qc.invalidateQueries();
    } catch {
      toast.error('Reset failed');
    } finally {
      setResetting(false);
    }
  }

  function handleSaveCredentials() {
    saveCredentials(username, password);
    toast.success('Credentials saved for this session');
  }

  return (
    <div>
      <Header title="Settings" subtitle="Mock environment administration · Not part of the assystREST contract" />
      <div className="p-6 space-y-6 max-w-2xl">

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Database className="w-4 h-4 text-brand-500" />Database Status
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Events', value: stats?.eventCount },
              { label: 'Users', value: stats?.userCount },
              { label: 'Support Groups', value: stats?.teamCount },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-slate-800">{value ?? '—'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-brand-500" />Seed / Reset Data
          </h2>
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-600 flex items-center gap-2">
              Event count:
              <input
                type="number" min={10} max={10000} step={10}
                value={seedCount}
                onChange={e => setSeedCount(Number(e.target.value))}
                className="w-24 text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSeed} loading={seeding} variant="secondary">
              <Database className="w-3.5 h-3.5" />Add Seed Data
            </Button>
            <Button onClick={handleReset} loading={resetting} variant="danger">
              <Trash2 className="w-3.5 h-3.5" />Reset &amp; Reseed
            </Button>
          </div>
          <p className="text-xs text-slate-400">
            "Add Seed Data" inserts/upserts events without dropping existing data.
            "Reset" drops all collections and fully reseeds.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-brand-500" />Session Credentials
          </h2>
          <p className="text-xs text-slate-500">
            Credentials are stored in <code>sessionStorage</code> only and not persisted.
            They are used for the Authorization: Basic header on all API requests.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Username</label>
              <input
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Password</label>
              <input
                type="password"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleSaveCredentials} variant="secondary" size="sm">Save Credentials</Button>
        </div>

        {config && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Server Configuration</h2>
            <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-4 overflow-auto">
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
