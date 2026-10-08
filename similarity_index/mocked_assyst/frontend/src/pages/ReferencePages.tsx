import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { PageLoader } from '@/components/ui/Spinner';
import { useUsers, useTeams, useCategories, useServices } from '@/hooks/useReferenceData';

function RefTable({ cols, rows }: { cols: string[]; rows: Record<string, unknown>[] }) {
  return (
    <div className="overflow-auto bg-white rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {cols.map(c => (
              <th key={c} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {cols.map(c => (
                <td key={c} className="px-4 py-3 text-slate-700">{String(row[c.toLowerCase()] ?? row[c] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UsersPage() {
  const { data, isLoading } = useUsers();
  return (
    <div>
      <Header title="Users" subtitle="assystREST /v2/assystUsers · ⚠️ Provisional endpoint path" />
      <div className="p-6">
        {isLoading ? <PageLoader /> : (
          <RefTable
            cols={['ID', 'shortCode', 'name', 'email']}
            rows={(data ?? []).map(u => ({ ID: u.id, shortCode: u.shortCode, name: u.name, email: u.email ?? '—' }))}
          />
        )}
      </div>
    </div>
  );
}

export function TeamsPage() {
  const { data, isLoading } = useTeams();
  return (
    <div>
      <Header title="Support Groups" subtitle="assystREST /v2/supportGroups · ⚠️ Provisional endpoint path" />
      <div className="p-6">
        {isLoading ? <PageLoader /> : (
          <RefTable
            cols={['ID', 'shortCode', 'name']}
            rows={(data ?? []).map(t => ({ ID: t.id, shortCode: t.shortCode, name: t.name }))}
          />
        )}
      </div>
    </div>
  );
}

export function CategoriesPage() {
  const { data, isLoading } = useCategories();
  return (
    <div>
      <Header title="Categories" subtitle="assystREST /v2/categories · ⚠️ Provisional endpoint path" />
      <div className="p-6 space-y-3">
        {isLoading ? <PageLoader /> : (data ?? []).map(cat => (
          <div key={cat.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-mono text-slate-400">#{cat.id}</span>
              <span className="text-sm font-semibold text-slate-800">{cat.name}</span>
              <span className="text-xs text-slate-400">{cat.shortCode}</span>
            </div>
            {cat.subCategories && cat.subCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 pl-4 border-l-2 border-slate-100">
                {cat.subCategories.map(sub => (
                  <span key={sub.id} className="text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-1">
                    {sub.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ServicesPage() {
  const { data, isLoading } = useServices();
  return (
    <div>
      <Header title="Services" subtitle="assystREST /v2/services · ⚠️ Provisional endpoint path" />
      <div className="p-6">
        {isLoading ? <PageLoader /> : (
          <RefTable
            cols={['ID', 'shortCode', 'name']}
            rows={(data ?? []).map(s => ({ ID: s.id, shortCode: s.shortCode, name: s.name }))}
          />
        )}
      </div>
    </div>
  );
}
