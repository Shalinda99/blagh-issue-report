import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Incidents } from '@/pages/Incidents';
import { IncidentDetail } from '@/pages/IncidentDetail';
import { NewIncident } from '@/pages/NewIncident';
import { UsersPage, TeamsPage, CategoriesPage, ServicesPage } from '@/pages/ReferencePages';
import { SimilarityLab } from '@/pages/SimilarityLab';
import { ApiExplorer } from '@/pages/ApiExplorer';
import { ApiContract } from '@/pages/ApiContract';
import { Settings } from '@/pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30 * 1000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="incidents/new" element={<NewIncident />} />
            <Route path="incidents/:id" element={<IncidentDetail />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="similarity" element={<SimilarityLab />} />
            <Route path="api-explorer" element={<ApiExplorer />} />
            <Route path="api-contract" element={<ApiContract />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
