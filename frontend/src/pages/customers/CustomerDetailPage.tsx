import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { ApiError } from '../../types/api';
import type { Customer, Followup } from '../../types/domain';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { formatDate, formatDateTime } from '../../utils/format';
import { ArrowLeftIcon, PencilIcon } from '../../components/ui/Icons';
import { CustomerFormModal } from './CustomerFormModal';
import { SkeletonRows, ErrorState } from '../../components/ui/State';
import styles from './CustomerDetail.module.css';

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [note, setNote] = useState('');
  const [noteDate, setNoteDate] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const canManage = can('ADMIN', 'SALES');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [customerRes, followupsRes] = await Promise.all([
        api.get<Customer>(`/customers/${id}`),
        api.get<{ data: Followup[] }>(`/customers/${id}/followups`),
      ]);
      setCustomer(customerRes.data!);
      setFollowups(followupsRes.data!.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const addFollowup = async (event: FormEvent) => {
    event.preventDefault();
    if (!note.trim()) {
      setNoteError('Enter a note for the follow-up.');
      return;
    }
    setSavingNote(true);
    setNoteError(null);
    try {
      const res = await api.post<Followup>(`/customers/${id}/followups`, {
        notes: note.trim(),
        followUpDate: noteDate || null,
      });
      setFollowups((current) => [res.data!, ...current]);
      setNote('');
      setNoteDate('');
      toast.success('Follow-up saved');
    } catch (err) {
      setNoteError(err instanceof ApiError ? err.message : 'Failed to save follow-up');
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) return <SkeletonRows rows={6} />;
  if (error || !customer)
    return <ErrorState title="Could not load this customer" description={error ?? 'Customer not found.'} onRetry={() => void load()} />;

  return (
    <div>
      <button className={styles.back} onClick={() => navigate('/customers')}>
        <ArrowLeftIcon /> Back to customers
      </button>

      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>{customer.business_name ?? customer.name}</h1>
          {customer.business_name && customer.business_name !== customer.name && (
            <span className={styles.subtitle}>{customer.name}</span>
          )}
        </div>
        <div className={styles.titleActions}>
          <StatusBadge value={customer.status} />
          {canManage && (
            <Button variant="secondary" icon={<PencilIcon />} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className={styles.grid}>
        <Card className={styles.detailsCard}>
          <Card.Header title="Contact details" />
          <div className={styles.detailList}>
            <DetailRow label="Name" value={customer.name} />
            <DetailRow label="Email" value={customer.email ?? '—'} link={customer.email ? `mailto:${customer.email}` : undefined} />
            <DetailRow label="Mobile" value={customer.mobile} />
            <DetailRow label="GST" value={customer.gst_number ?? '—'} mono />
            <DetailRow label="Type" value={customer.type} />
            <DetailRow label="Address" value={customer.address ?? '—'} />
          </div>
        </Card>

        <Card className={styles.followupCard}>
          <Card.Header title="Add follow-up" />
          {canManage ? (
            <form onSubmit={addFollowup} className={styles.followupForm}>
              <Field label="Notes" required error={noteError ?? undefined}>
                <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What happened on this follow-up?" invalid={Boolean(noteError)} />
              </Field>
              <Field label="Next follow-up date">
                <Input type="date" value={noteDate} onChange={(event) => setNoteDate(event.target.value)} />
              </Field>
              <Button type="submit" loading={savingNote} disabled={!note.trim()}>
                Save follow-up
              </Button>
            </form>
          ) : (
            <p className={styles.readOnly}>Follow-ups are managed by sales and admin users.</p>
          )}
        </Card>
      </div>

      <Card className={styles.timelineCard}>
        <Card.Header title="Follow-up history" description={`${followups.length} follow-up${followups.length === 1 ? '' : 's'}`} />
        {followups.length === 0 ? (
          <p className={styles.noFollowups}>No follow-ups recorded yet.</p>
        ) : (
          <ol className={styles.timeline}>
            {followups.map((item) => (
              <li key={item.id} className={styles.timelineItem}>
                <div className={styles.dot} />
                <div className={styles.timelineBody}>
                  <p className={styles.timelineNote}>{item.notes}</p>
                  <p className={styles.timelineMeta}>
                    {item.created_by_name ?? 'Unknown'} · {formatDateTime(item.created_at)}
                    {item.follow_up_date ? ` · next: ${formatDate(item.follow_up_date)}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <CustomerFormModal
        open={editOpen}
        customer={customer}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          setEditOpen(false);
          setCustomer(updated);
          toast.success('Customer updated');
        }}
      />
    </div>
  );
}

function DetailRow({ label, value, mono, link }: { label: string; value: string; mono?: boolean; link?: string }) {
  return (
    <div className={styles.detailRow}>
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>
        {link ? (
          <a href={link} className={styles.link}>
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}