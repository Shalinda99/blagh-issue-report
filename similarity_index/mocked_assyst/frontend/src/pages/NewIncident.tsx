import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { useCreateEvent } from '@/hooks/useEvents';
import { useCategories, useServices, useTeams } from '@/hooks/useReferenceData';
import { extractAxiosError } from '@/lib/utils';
import type { EventType } from '@/types';

const schema = z.object({
  shortDescription: z.string().min(5, 'Minimum 5 characters').max(500),
  remarks: z.string().optional(),
  eventType: z.string().default('INCIDENT'),
  priorityCode: z.string().default('P3'),
  categoryId: z.string().optional(),
  serviceId: z.string().optional(),
  assignedGroupId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function NewIncident() {
  const navigate = useNavigate();
  const create = useCreateEvent();
  const { data: categories } = useCategories();
  const { data: services } = useServices();
  const { data: teams } = useTeams();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { eventType: 'INCIDENT', priorityCode: 'P3' },
  });

  async function onSubmit(data: FormValues) {
    try {
      const body = {
        ...data,
        eventType: data.eventType as EventType,
        categoryId: data.categoryId ? Number(data.categoryId) : undefined,
        serviceId: data.serviceId ? Number(data.serviceId) : undefined,
        assignedGroupId: data.assignedGroupId ? Number(data.assignedGroupId) : undefined,
      };
      const created = await create.mutateAsync(body);
      toast.success(`Incident ${created.eventRef} created`);
      navigate(`/incidents/${created.id}`);
    } catch (err) {
      toast.error(extractAxiosError(err));
    }
  }

  const fieldClass = 'w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500';
  const errorClass = 'text-xs text-red-500 mt-1';
  const labelClass = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div>
      <Header title="New Incident" subtitle="POST /assystREST/v2/events" />
      <div className="p-6 max-w-2xl">
        <Link to="/incidents" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline mb-4">
          <ArrowLeft className="w-4 h-4" />Back
        </Link>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Event Type</label>
                <select {...register('eventType')} className={fieldClass}>
                  {['INCIDENT', 'PROBLEM', 'CHANGE', 'SERVICE_REQUEST'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Priority</label>
                <select {...register('priorityCode')} className={fieldClass}>
                  {['P1', 'P2', 'P3', 'P4'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Short Description *</label>
              <input {...register('shortDescription')} className={fieldClass} placeholder="Brief description of the incident" />
              {errors.shortDescription && <p className={errorClass}>{errors.shortDescription.message}</p>}
            </div>

            <div>
              <label className={labelClass}>Remarks</label>
              <textarea {...register('remarks')} className={fieldClass} rows={4} placeholder="Additional details…" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Category</label>
                <select {...register('categoryId')} className={fieldClass}>
                  <option value="">— None —</option>
                  {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Service</label>
                <select {...register('serviceId')} className={fieldClass}>
                  <option value="">— None —</option>
                  {services?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Assigned Group</label>
                <select {...register('assignedGroupId')} className={fieldClass}>
                  <option value="">— None —</option>
                  {teams?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" loading={isSubmitting}>Create Incident</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
