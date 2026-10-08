import { useState } from 'react';
import { Beaker, Search, AlertTriangle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { fetchEvents } from '@/api/events';
import type { AssystEvent } from '@/types';
import { statusColor, priorityColor, formatDate } from '@/lib/utils';

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const inter = new Set([...setA].filter(t => setB.has(t)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

interface ScoredEvent extends AssystEvent {
  similarity: number;
}

export function SimilarityLab() {
  const [query, setQuery] = useState('');
  const [threshold, setThreshold] = useState(0.2);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ScoredEvent[]>([]);
  const [searched, setSearched] = useState(false);
  const [fetchedCount, setFetchedCount] = useState(0);

  async function runSearch() {
    if (!query.trim()) return;
    setIsLoading(true);
    setSearched(false);
    try {
      const queryTokens = tokenize(query);
      let allEvents: AssystEvent[] = [];
      let page = 0;
      const pageSize = 100;

      while (true) {
        const batch = await fetchEvents({ startRow: page * pageSize, numberOfRows: pageSize });
        allEvents = allEvents.concat(batch);
        if (batch.length < pageSize) break;
        page++;
        if (page > 10) break;
      }

      setFetchedCount(allEvents.length);

      const scored: ScoredEvent[] = allEvents
        .map(evt => {
          const text = `${evt.shortDescription ?? ''} ${evt.remarks ?? ''}`;
          const tokens = tokenize(text);
          return { ...evt, similarity: jaccardSimilarity(queryTokens, tokens) };
        })
        .filter(e => e.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity);

      setResults(scored);
      setSearched(true);
    } finally {
      setIsLoading(false);
    }
  }

  const CLUSTERS = [
    'Unable to log into the employee portal',
    'Production database connection refused',
    'API gateway returning 504 timeout errors',
    'Production deployment failed — service unavailable',
  ];

  return (
    <div>
      <Header
        title="Similarity Test Lab"
        subtitle="Test incident similarity using the Axios assyst dataset · Jaccard token overlap"
      />
      <div className="p-6 space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <div>
            <strong>Mock-only feature.</strong> This lab fetches all incidents from the mock API and runs a
            client-side Jaccard token similarity search. It is designed to validate the similarity cluster
            seed data, not to replace the real Similarity Check Index algorithm.
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Beaker className="w-4 h-4 text-brand-500" />Query
          </h2>
          <textarea
            className="w-full border border-slate-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
            rows={3}
            placeholder="Enter an incident description to find similar incidents…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="flex items-center gap-4">
            <label className="text-sm text-slate-600 flex items-center gap-2">
              Similarity threshold:
              <input
                type="range" min={0.05} max={0.8} step={0.05}
                value={threshold}
                onChange={e => setThreshold(Number(e.target.value))}
                className="w-32"
              />
              <span className="text-xs font-mono text-slate-500">{threshold.toFixed(2)}</span>
            </label>
            <Button onClick={runSearch} loading={isLoading} disabled={!query.trim()}>
              <Search className="w-4 h-4" />Search
            </Button>
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-2">Pre-loaded test queries (similarity clusters):</p>
            <div className="flex flex-wrap gap-2">
              {CLUSTERS.map(c => (
                <button
                  key={c}
                  onClick={() => setQuery(c)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full px-3 py-1.5 transition-colors"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading && <PageLoader />}

        {searched && !isLoading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                {results.length} matches from {fetchedCount} incidents · threshold ≥ {threshold.toFixed(2)}
              </h2>
            </div>

            {results.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                No incidents met the similarity threshold. Try lowering the threshold.
              </div>
            ) : results.map(evt => (
              <div key={evt.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-slate-400">{evt.eventRef}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${statusColor(evt.eventStatus)}`}>
                        {evt.eventStatus?.replace('_', ' ')}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${priorityColor(evt.priorityCode)}`}>
                        {evt.priorityCode}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">{evt.shortDescription}</p>
                    {evt.remarks && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{evt.remarks}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className="text-lg font-bold"
                      style={{ color: evt.similarity > 0.5 ? '#16a34a' : evt.similarity > 0.3 ? '#ca8a04' : '#9ca3af' }}
                    >
                      {(evt.similarity * 100).toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-slate-400">similarity</div>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  Created {formatDate(evt.creationDate)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
