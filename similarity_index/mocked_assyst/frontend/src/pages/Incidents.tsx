import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { useEvents } from '@/hooks/useEvents';
import { useCategories, useServices, useTeams } from '@/hooks/useReferenceData';
import { statusColor, priorityColor, statusLabel, formatDate } from '@/lib/utils';

const PAGE_SIZE = 25;

const EVENT_TYPES = ['INCIDENT', 'PROBLEM', 'CHANGE', 'SERVICE_REQUEST'];
const EVENT_STATUSES = ['OPEN', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];

export function Incidents() {
  const [page, setPage] = useState(0);
  const [eventType, setEventType] = useState('');
  const [eventStatus, setEventStatus] = useState('');
  const [priorityCode, setPriorityCode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [sortField, setSortField] = useState('creationDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  const { data: categories } = useCategories();
  const { data: services } = useServices();

  const params = {
    startRow: page * PAGE_SIZE,
    numberOfRows: PAGE_SIZE,
    eventType: eventType || undefined,
    eventStatus: eventStatus || undefined,
    priorityCode: priorityCode || undefined,
    categoryId: categoryId ? Number(categoryId) : undefined,
    serviceId: serviceId ? Number(serviceId) : undefined,
    sortField,
    sortOrder,
    fields: 'affectedUser,assignedGroup,service,category',
  };

  const { data: events, isLoading, isFetching } = useEvents(params);

  function resetFilters() {
    setEventType(''); setEventStatus(''); setPriorityCode('');
    setCategoryId(''); setServiceId(''); setPage(0);
  }

  const hasFilters = !!(eventType || eventStatus || priorityCode || categoryId || serviceId);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Incidents"
        subtitle={`assystREST /v2/events · ${isFetching ? 'Loading…' : `${events?.length ?? 0} results`}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(f => !f)}>
              <Filter className="w-3.5 h-3.5" />
              Filters {hasFilters && <span className="ml-1 bg-brand-600 text-white rounded-full px-1.5 py-0.5 text-[10px]">ON</span>}
            </Button>
            <Link to="/incidents/new">
              <Button size="sm"><Plus className="w-3.5 h-3.5" />New Incident</Button>
            </Link>
          </div>
        }
      />

      {showFilters && (
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <select
              value={eventType} onChange={e => { setEventType(e.target.value); setPage(0); }}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Types</option>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={eventStatus} onChange={e => { setEventStatus(e.target.value); setPage(0); }}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Statuses</option>
              {EVENT_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
            <select
              value={priorityCode} onChange={e => { setPriorityCode(e.target.value); setPage(0); }}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(0); }}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Categories</option>
              {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={serviceId} onChange={e => { setServiceId(e.target.value); setPage(0); }}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Services</option>
              {services?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {hasFilters && (
            <button onClick={resetFilters} className="mt-2 text-xs text-brand-600 hover:underline">
              Clear all filters
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto bg-white">
        {isLoading ? (
          <PageLoader />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                {[
                  { key: 'eventRef', label: 'Ref' },
                  { key: 'eventType', label: 'Type' },
                  { key: 'shortDescription', label: 'Description' },
                  { key: 'eventStatus', label: 'Status' },
                  { key: 'priorityCode', label: 'Priority' },
                  { key: 'creationDate', label: 'Created' },
                  { key: 'lastModifiedDate', label: 'Modified' },
                ].map(col => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-800 select-none"
                    onClick={() => {
                      if (sortField === col.key) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
                      else { setSortField(col.key); setSortOrder('desc'); }
                    }}
                  >
                    {col.label} {sortField === col.key && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events?.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-slate-400">No incidents found</td></tr>
              ) : events?.map(evt => (
                <tr key={evt.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/incidents/${evt.id}`} className="font-mono text-xs text-brand-600 hover:underline">
                      {evt.eventRef}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-500">{evt.eventType}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <Link to={`/incidents/${evt.id}`} className="text-slate-800 hover:text-brand-700 line-clamp-1">
                      {evt.shortDescription}
                    </Link>
                    {evt.category?.name && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{evt.category.name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${statusColor(evt.eventStatus)}`}>
                      {statusLabel(evt.eventStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${priorityColor(evt.priorityCode)}`}>
                      {evt.priorityCode} · {evt.priorityDescription}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(evt.creationDate)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(evt.lastModifiedDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Page {page + 1} · Rows {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + (events?.length ?? 0)}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-3.5 h-3.5" />Prev
          </Button>
          <Button variant="outline" size="sm" disabled={(events?.length ?? 0) < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
            Next<ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
