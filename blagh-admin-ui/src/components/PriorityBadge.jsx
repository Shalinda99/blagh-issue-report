export default function PriorityBadge({ priority }) {
  if (!priority) return <span style={{ color: 'var(--muted)' }}>—</span>;
  return (
    <span className={`badge badge-${priority.toLowerCase()}`}>
      {priority}
    </span>
  );
}
