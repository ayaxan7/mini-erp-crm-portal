import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { ApiError } from '../../types/api';
import type { AccessRequest } from '../../types/domain';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { PageHeader } from '../../components/ui/Card';
import { Badge, statusTone } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, Input, Textarea } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { formatDateTime } from '../../utils/format';
import { CheckIcon, XIcon } from '../../components/ui/Icons';
import styles from './AccessRequestsPage.module.css';

interface ListResponse {
  data: AccessRequest[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface ApproveResult {
  request: AccessRequest;
  user: { id: number; name: string; email: string; role: string };
  generatedPassword?: string;
}

const TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export function AccessRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<AccessRequest[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [approving, setApproving] = useState<AccessRequest | null>(null);
  const [rejecting, setRejecting] = useState<AccessRequest | null>(null);

  const page = Number(searchParams.get('page')) || 1;
  const status = searchParams.get('status') ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ListResponse>('/auth/access-requests', {
        page,
        limit: 10,
        status: status || undefined,
      });
      setRows(res.data!.data);
      setMeta(res.data!.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load access requests');
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('status', value);
    else next.delete('status');
    next.delete('page');
    setSearchParams(next);
  };

  const columns: Column<AccessRequest>[] = [
    {
      key: 'requester',
      header: 'Requester',
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          <div className="text-muted">{row.email}</div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (row) => <Badge tone={statusTone(row.role)}>{row.role}</Badge> },
    {
      key: 'message',
      header: 'Message',
      render: (row) => (
        <span className={row.message ? styles.message : styles.muted}>{row.message ?? '—'}</span>
      ),
    },
    { key: 'submitted', header: 'Submitted', render: (row) => <span className="text-secondary">{formatDateTime(row.created_at)}</span> },
    {
      key: 'reviewed',
      header: 'Reviewed',
      render: (row) =>
        row.reviewed_at ? (
          <div>
            <div className="text-secondary">{formatDateTime(row.reviewed_at)}</div>
            {row.reviewer_name && <div className="text-muted">by {row.reviewer_name}</div>}
            {row.review_note && <div className={styles.reviewNote}>{row.review_note}</div>}
          </div>
        ) : (
          <span className={styles.muted}>—</span>
        ),
    },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        row.status === 'PENDING' ? (
          <div className={styles.inlineActions}>
            <Button size="sm" icon={<CheckIcon />} onClick={() => setApproving(row)}>
              Approve
            </Button>
            <Button size="sm" variant="secondary" icon={<XIcon />} onClick={() => setRejecting(row)}>
              Reject
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Access requests"
        description={`${meta.total} request${meta.total === 1 ? '' : 's'} in this view`}
      />

      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            className={`${styles.tab} ${status === tab.value ? styles.active : ''}`}
            onClick={() => setTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className={styles.error}>{error}</p>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(row) => row.id}
          loading={loading}
          emptyLabel="No access requests found"
          emptyDescription={status ? 'Try another status tab.' : 'Requests from the login page will appear here.'}
          bottomContent={
            <Pagination page={page} totalPages={meta.totalPages} onPageChange={(next) => {
              const params = new URLSearchParams(searchParams);
              params.set('page', String(next));
              setSearchParams(params);
            }} />
          }
        />
      )}

      {approving && <ApproveModal request={approving} onClose={() => setApproving(null)} onDone={() => { setApproving(null); void load(); }} />}
      {rejecting && <RejectModal request={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); void load(); }} />}
    </div>
  );
}

function ApproveModal({ request, onClose, onDone }: { request: AccessRequest; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [initialPassword, setInitialPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<ApproveResult | null>(null);

  const submit = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const res = await api.patch<ApproveResult>(`/auth/access-requests/${request.id}/approve`, {
        initialPassword: initialPassword.trim() || null,
      });
      setResult(res.data!);
      toast.success(`Account created for ${res.data!.user.email}`);
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message);
      else setFormError('Unexpected error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const copyPassword = async () => {
    if (!result?.generatedPassword) return;
    await navigator.clipboard.writeText(result.generatedPassword);
    toast.info('Password copied to clipboard');
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`Approve ${request.name}`}
      footer={
        result ? (
          <Button onClick={onDone}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} loading={saving} icon={<CheckIcon />}>
              Approve &amp; create account
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className={styles.approved}>
          <p className={styles.approvedTitle}>Account created</p>
          <p>
            <b>{result.user.name}</b> · {result.user.email} · {result.user.role}
          </p>
          {result.generatedPassword ? (
            <>
              <p className={styles.approvedHint}>Share this one-time password with the user — they will need it to sign in:</p>
              <div className={styles.passwordBox}>
                <code className="mono">{result.generatedPassword}</code>
                <Button size="sm" variant="secondary" onClick={copyPassword}>
                  Copy
                </Button>
              </div>
            </>
          ) : (
            <p className={styles.approvedHint}>The user can sign in with the password you set.</p>
          )}
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          noValidate
        >
          <p className={styles.requesterInfo}>
            <b>{request.name}</b> · {request.email} · {request.role}
          </p>
          <Field
            label="Initial password (optional)"
            hint="Leave blank to auto-generate a temporary password. Must be at least 8 characters with upper & lower case, a number and a special character."
            error={formError ?? undefined}
          >
            <Input
              type="text"
              value={initialPassword}
              onChange={(event) => setInitialPassword(event.target.value)}
              placeholder="Leave blank to generate one"
              autoComplete="new-password"
            />
          </Field>
        </form>
      )}
    </Modal>
  );
}

function RejectModal({ request, onClose, onDone }: { request: AccessRequest; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await api.patch(`/auth/access-requests/${request.id}/reject`, { reason: reason.trim() || null });
      toast.success(`Request from ${request.name} rejected`);
      onDone();
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message);
      else setFormError('Unexpected error. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Reject ${request.name}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={saving} icon={<XIcon />}>
            Reject request
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        <p className={styles.requesterInfo}>
          <b>{request.name}</b> · {request.email} · {request.role}
        </p>
        <Field label="Reason (optional)" hint="Shown to help the applicant understand." error={formError ?? undefined}>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
