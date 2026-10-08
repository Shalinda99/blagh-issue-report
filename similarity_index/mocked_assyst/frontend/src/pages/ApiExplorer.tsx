import { useState } from 'react';
import { Terminal, Play, Copy, Check } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import client from '@/api/client';

interface Endpoint {
  label: string;
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  description: string;
  defaultBody?: string;
}

const ENDPOINTS: Endpoint[] = [
  { label: 'List Events', method: 'GET', path: '/assystREST/v2/events?startRow=0&numberOfRows=10', description: '✅ Verified — bare JSON array response' },
  { label: 'Get Event', method: 'GET', path: '/assystREST/v2/events/10000001', description: 'Get a single event by ID' },
  { label: 'Get Event (expanded)', method: 'GET', path: '/assystREST/v2/events/10000001?fields=affectedUser,assignedGroup,service,category', description: '✅ Verified — nested object expansion' },
  { label: 'Filter by Status', method: 'GET', path: '/assystREST/v2/events?eventStatus=OPEN&numberOfRows=5', description: 'Filter incidents by status' },
  { label: 'Filter by Priority', method: 'GET', path: '/assystREST/v2/events?priorityCode=P1&numberOfRows=5', description: 'Filter by priority code' },
  { label: 'Date Range Filter', method: 'GET', path: '/assystREST/v2/events?creationDate=2026-01-01T00:00:00Z,&numberOfRows=10', description: '✅ Verified — comma-separated date range' },
  { label: 'Paginate', method: 'GET', path: '/assystREST/v2/events?startRow=25&numberOfRows=5', description: '⚠️ Provisional pagination parameters' },
  { label: 'List Users', method: 'GET', path: '/assystREST/v2/assystUsers', description: '⚠️ Provisional endpoint path' },
  { label: 'List Support Groups', method: 'GET', path: '/assystREST/v2/supportGroups', description: '⚠️ Provisional endpoint path' },
  { label: 'List Categories', method: 'GET', path: '/assystREST/v2/categories', description: '⚠️ Provisional endpoint path' },
  { label: 'List Services', method: 'GET', path: '/assystREST/v2/services', description: '⚠️ Provisional endpoint path' },
  { label: 'Health Check', method: 'GET', path: '/health', description: 'Mock-only health check' },
  { label: 'Mock Stats', method: 'GET', path: '/mock/admin/stats', description: 'Mock-only admin stats' },
  { label: 'Mock Config', method: 'GET', path: '/mock/admin/config', description: 'Mock-only configuration' },
  {
    label: 'Create Incident', method: 'POST', path: '/assystREST/v2/events',
    description: '✅ Verified — POST for creation',
    defaultBody: JSON.stringify({ eventType: 'INCIDENT', shortDescription: 'Test incident from API Explorer', remarks: 'Created via the mock API Explorer', priorityCode: 'P3' }, null, 2),
  },
];

export function ApiExplorer() {
  const [selected, setSelected] = useState<Endpoint>(ENDPOINTS[0]);
  const [customPath, setCustomPath] = useState(ENDPOINTS[0].path);
  const [method, setMethod] = useState<string>(ENDPOINTS[0].method);
  const [body, setBody] = useState(ENDPOINTS[0].defaultBody ?? '');
  const [response, setResponse] = useState<unknown>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);

  function selectEndpoint(ep: Endpoint) {
    setSelected(ep);
    setCustomPath(ep.path);
    setMethod(ep.method);
    setBody(ep.defaultBody ?? '');
    setResponse(null);
    setStatus(null);
    setError('');
  }

  async function execute() {
    setLoading(true);
    setResponse(null);
    setError('');
    const t0 = Date.now();
    try {
      let res;
      if (method === 'GET' || method === 'DELETE') {
        res = await client.request({ method, url: customPath });
      } else {
        const parsed = body ? JSON.parse(body) : undefined;
        res = await client.request({ method, url: customPath, data: parsed });
      }
      setStatus(res.status);
      setResponse(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: unknown }; message?: string };
      setStatus(e.response?.status ?? null);
      setResponse(e.response?.data ?? null);
      setError(e.message ?? 'Request failed');
    } finally {
      setElapsed(Date.now() - t0);
      setLoading(false);
    }
  }

  async function copyJson() {
    if (!response) return;
    await navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const statusOk = status && status < 400;

  return (
    <div>
      <Header title="API Explorer" subtitle="Make live requests to the Axios assystREST API" />
      <div className="flex h-[calc(100vh-64px)]">
        <div className="w-64 shrink-0 bg-slate-50 border-r border-slate-200 overflow-y-auto p-3 space-y-1">
          {ENDPOINTS.map(ep => (
            <button
              key={ep.label}
              onClick={() => selectEndpoint(ep)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selected.label === ep.label
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className={`text-[10px] font-bold mr-2 ${
                ep.method === 'POST' ? 'text-green-500' :
                ep.method === 'DELETE' ? 'text-red-500' : 'text-blue-500'
              } ${selected.label === ep.label ? '!text-current opacity-75' : ''}`}>
                {ep.method}
              </span>
              {ep.label}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden p-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs text-slate-500">{selected.description}</p>
            <div className="flex gap-2">
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {['GET', 'POST', 'DELETE'].map(m => <option key={m}>{m}</option>)}
              </select>
              <input
                className="flex-1 font-mono text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={customPath}
                onChange={e => setCustomPath(e.target.value)}
              />
              <Button onClick={execute} loading={loading}>
                <Play className="w-3.5 h-3.5" />Send
              </Button>
            </div>
            {(method === 'POST') && (
              <textarea
                className="w-full font-mono text-xs border border-slate-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                rows={6}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Request body (JSON)"
              />
            )}
          </div>

          {(response !== null || error) && (
            <div className="flex-1 overflow-auto bg-slate-900 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Terminal className="w-4 h-4 text-slate-400" />
                  <span className={`text-sm font-mono font-bold ${statusOk ? 'text-green-400' : 'text-red-400'}`}>
                    HTTP {status}
                  </span>
                  {elapsed !== null && (
                    <span className="text-xs text-slate-500">{elapsed}ms</span>
                  )}
                  {error && <span className="text-xs text-red-400">{error}</span>}
                </div>
                <Button variant="ghost" size="sm" onClick={copyJson} className="text-slate-400 hover:text-white">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <pre className="text-green-300 text-xs leading-relaxed overflow-auto">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
