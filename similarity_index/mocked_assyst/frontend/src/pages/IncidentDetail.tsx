import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Code, Paperclip, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { useEvent, useUpdateEvent, useDeleteEvent, useEventAttachments } from '@/hooks/useEvents';
import { fetchAttachmentBlob } from '@/api/events';
import type { AssystAttachment } from '@/types';
import { statusColor, priorityColor, statusLabel, formatDate, extractAxiosError } from '@/lib/utils';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function AttachmentCard({ eventId, attachment }: { eventId: number; attachment: AssystAttachment }) {
  const [url, setUrl] = useState<string>('');
  const [failed, setFailed] = useState(false);
  const isImage = (attachment.contentType ?? '').startsWith('image/');

  useEffect(() => {
    let revoke = '';
    let active = true;
    fetchAttachmentBlob(eventId, attachment.id)
      .then((blob) => {
        if (!active) return;
        revoke = URL.createObjectURL(blob);
        setUrl(revoke);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [eventId, attachment.id]);

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
      {isImage && url && !failed ? (
        <a href={url} target="_blank" rel="noopener noreferrer" title={`${attachment.fileName} — open full size`}>
          <img src={url} alt={attachment.fileName} className="w-full h-36 object-cover hover:opacity-90 transition" />
        </a>
      ) : (
        <div className="w-full h-36 flex items-center justify-center text-slate-400">
          {failed ? <span className="text-xs">Failed to load</span> : <FileText className="w-8 h-8" />}
        </div>
      )}
      <div className="px-3 py-2 border-t border-slate-100">
        <div className="text-xs font-medium text-slate-700 truncate" title={attachment.fileName}>
          {attachment.fileName}
        </div>
        <div className="text-[11px] text-slate-400">{formatBytes(attachment.size)}</div>
      </div>
    </div>
  );
}

const FIELD_EXPAND = 'affectedUser,assignedGroup,assignedTech,service,category,subCategory';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED'];

export function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const eventId = Number(id);
  const [showJson, setShowJson] = useState(false);
  const [editStatus, setEditStatus] = useState('');

  const { data: event, isLoading } = useEvent(eventId, FIELD_EXPAND);
  const { data: attachments = [] } = useEventAttachments(eventId);
  const updateMutation = useUpdateEvent(eventId);
  const deleteMutation = useDeleteEvent();

  async function handleStatusChange(newStatus: string) {
    try {
      await updateMutation.mutateAsync({ eventStatus: newStatus as never });
      toast.success(`Status updated to ${newStatus}`);
      setEditStatus('');
    } catch (err) {
      toast.error(extractAxiosError(err));
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this incident permanently?')) return;
    try {
      await deleteMutation.mutateAsync(eventId);
      toast.success('Incident deleted');
      navigate('/incidents');
    } catch (err) {
      toast.error(extractAxiosError(err));
    }
  }

  if (isLoading) return <PageLoader />;
  if (!event) return <div className="p-8 text-slate-500">Event not found.</div>;

  const fields = [
    { label: 'Reference', value: event.eventRef },
    { label: 'Type', value: event.eventType },
    { label: 'Priority', value: `${event.priorityCode} — ${event.priorityDescription}` },
    { label: 'Impact', value: event.impact },
    { label: 'Urgency', value: event.urgency },
    { label: 'Created', value: formatDate(event.creationDate) },
    { label: 'Last Modified', value: formatDate(event.lastModifiedDate) },
    { label: 'Resolved', value: formatDate(event.resolvedDate) },
    { label: 'Closed', value: formatDate(event.closedDate) },
    { label: 'Affected User', value: event.affectedUser?.name ?? event.affectedUserId },
    { label: 'Assigned Group', value: event.assignedGroup?.name ?? event.assignedGroupId },
    { label: 'Assigned Tech', value: event.assignedTech?.name ?? event.assignedTechId },
    { label: 'Service', value: event.service?.name ?? event.serviceId },
    { label: 'Category', value: event.category?.name ?? event.categoryId },
    { label: 'Sub-Category', value: event.subCategory?.name ?? event.subCategoryId },
    { label: 'Resolution Code', value: event.resolutionCode },
    { label: 'Version', value: event.version },
  ];

  return (
    <div>
      <Header
        title={event.eventRef ?? `Incident #${event.id}`}
        subtitle={event.shortDescription}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowJson(v => !v)}>
              <Code className="w-3.5 h-3.5" />{showJson ? 'Detail' : 'Raw JSON'}
            </Button>
            <Button variant="danger" size="sm" loading={deleteMutation.isPending} onClick={handleDelete}>
              <Trash2 className="w-3.5 h-3.5" />Delete
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <Link to="/incidents" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
          <ArrowLeft className="w-4 h-4" />Back to incidents
        </Link>

        {showJson ? (
          <div className="bg-slate-900 rounded-xl p-5 overflow-auto">
            <pre className="text-green-400 text-xs leading-relaxed">{JSON.stringify(event, null, 2)}</pre>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium border ${statusColor(event.eventStatus)}`}>
                    {statusLabel(event.eventStatus)}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium border ${priorityColor(event.priorityCode)}`}>
                    {event.priorityCode} · {event.priorityDescription}
                  </span>
                </div>

                <h2 className="text-base font-semibold text-slate-800 mb-3">Description</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{event.shortDescription}</p>

                {event.remarks && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Remarks</h3>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{event.remarks}</p>
                  </div>
                )}

                {event.resolutionRemarks && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Resolution</h3>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{event.resolutionRemarks}</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-slate-500" />
                  Attachments
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-600 text-white text-[11px] font-bold">
                    {attachments.length}
                  </span>
                </h2>
                {attachments.length === 0 ? (
                  <p className="text-sm text-slate-400">No attachments on this incident.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {attachments.map((a) => (
                      <AttachmentCard key={a.id} eventId={eventId} attachment={a} />
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-4">Update Status</h2>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map(s => (
                    <Button
                      key={s}
                      variant={event.eventStatus === s ? 'primary' : 'outline'}
                      size="sm"
                      loading={updateMutation.isPending && editStatus === s}
                      onClick={() => { setEditStatus(s); handleStatusChange(s); }}
                    >
                      {statusLabel(s)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Details</h2>
                <dl className="space-y-2.5">
                  {fields.filter(f => f.value !== undefined && f.value !== null && f.value !== '').map(f => (
                    <div key={f.label}>
                      <dt className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{f.label}</dt>
                      <dd className="text-sm text-slate-700 mt-0.5">{String(f.value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
