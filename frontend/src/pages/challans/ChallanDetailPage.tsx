import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fetchBlob, downloadBlob } from '../../services/api';
import { ApiError } from '../../types/api';
import type { Challan, ChallanItem } from '../../types/domain';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { formatDateTime, formatMoney } from '../../utils/format';
import { ArrowLeftIcon, CheckIcon, XIcon, DocumentIcon } from '../../components/ui/Icons';
import { SkeletonRows, ErrorState } from '../../components/ui/State';
import styles from './ChallanDetail.module.css';

interface ChallanDetail {
  challan: Challan;
  items: ChallanItem[];
}

export function ChallanDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();

  const [detail, setDetail] = useState<ChallanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const canManage = can('ADMIN', 'SALES');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ChallanDetail>(`/challans/${id}`);
      setDetail(res.data!);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load challan');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = async () => {
    setActing(true);
    try {
      const res = await api.patch<ChallanDetail>(`/challans/${id}/confirm`);
      setDetail(res.data!);
      setConfirmOpen(false);
      toast.success('Challan confirmed — stock deducted');
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to confirm challan');
    } finally {
      setActing(false);
    }
  };

  const cancel = async () => {
    setActing(true);
    try {
      const res = await api.patch<ChallanDetail>(`/challans/${id}/cancel`);
      setDetail(res.data!);
      setCancelOpen(false);
      toast.success('Challan cancelled');
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to cancel challan');
    } finally {
      setActing(false);
    }
  };

  const viewInvoice = async () => {
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Pop-up blocked — please allow pop-ups for this site');
      return;
    }
    win.document.write('Loading invoice…');
    try {
      const blob = await fetchBlob(`/challans/${id}/invoice`);
      win.location.href = URL.createObjectURL(blob);
    } catch (err) {
      win.close();
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to load invoice');
    }
  };

  const downloadInvoice = async () => {
    setPdfLoading(true);
    try {
      const blob = await fetchBlob(`/challans/${id}/invoice.pdf`);
      downloadBlob(blob, `invoice-${id}.pdf`);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Failed to download invoice PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) return <SkeletonRows rows={6} />;
  if (error || !detail)
    return <ErrorState title="Could not load this challan" description={error ?? 'Challan not found.'} onRetry={() => void load()} />;

  const { challan, items } = detail;
  const totalValue = items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);

  const columns: Column<ChallanItem>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (row) => (
        <div className={styles.productCell}>
          <span>{row.product_name}</span>
          <span className="mono text-muted">{row.product_sku}</span>
        </div>
      ),
    },
    { key: 'price', header: 'Unit price', align: 'right', render: (row) => <span className="mono">{formatMoney(row.unit_price)}</span> },
    { key: 'qty', header: 'Quantity', align: 'right', render: (row) => <span className="mono">{row.quantity}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: (row) => <span className="mono">{formatMoney(Number(row.unit_price) * row.quantity)}</span> },
  ];

  return (
    <div>
      <button className={styles.back} onClick={() => navigate('/challans')}>
        <ArrowLeftIcon /> Back to challans
      </button>

      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>{challan.challan_number}</h1>
          <span className="text-secondary">Created {formatDateTime(challan.created_at)} by {challan.created_by_name ?? '—'}</span>
        </div>
        <div className={styles.titleActions}>
          <StatusBadge value={challan.status} />
          {canManage && (
            <>
              <Button variant="secondary" icon={<DocumentIcon />} onClick={() => void viewInvoice()}>
                View invoice
              </Button>
              <Button variant="secondary" icon={<DocumentIcon />} onClick={() => void downloadInvoice()} disabled={pdfLoading}>
                {pdfLoading ? 'Preparing…' : 'Download PDF'}
              </Button>
            </>
          )}
          {canManage && challan.status === 'DRAFT' && (
            <Button variant="secondary" icon={<CheckIcon />} onClick={() => setConfirmOpen(true)}>
              Confirm challan
            </Button>
          )}
          {canManage && challan.status !== 'CANCELLED' && (
            <Button variant="danger" icon={<XIcon />} onClick={() => setCancelOpen(true)}>
              Cancel challan
            </Button>
          )}
        </div>
      </div>

      <div className={styles.grid}>
        <Card>
          <Card.Header title="Customer" />
          <div className={styles.detailBody}>
            <p className={styles.customerName}>{challan.customer_name ?? 'Unknown customer'}</p>
            {challan.customer_business_name && <p className="text-secondary">{challan.customer_business_name}</p>}
            <dl className={styles.metaList}>
              <MetaRow label="Customer ID" value={`#${challan.customer_id}`} mono />
              <MetaRow label="Challan status" value={challan.status} />
              {challan.confirmed_at && <MetaRow label="Confirmed" value={formatDateTime(challan.confirmed_at)} />}
              {challan.cancelled_at && <MetaRow label="Cancelled" value={formatDateTime(challan.cancelled_at)} />}
            </dl>
          </div>
        </Card>

        <Card>
          <Card.Header title="Summary" />
          <div className={styles.detailBody}>
            <dl className={styles.metaList}>
              <MetaRow label="Total quantity" value={String(challan.total_quantity)} mono />
              <MetaRow label="Lines" value={String(items.length)} />
              <MetaRow label="Total value" value={formatMoney(totalValue)} mono strong />
              <MetaRow label="Created" value={formatDateTime(challan.created_at)} />
              <MetaRow label="Last updated" value={formatDateTime(challan.updated_at)} />
            </dl>
            {challan.status === 'CANCELLED' && (
              <p className={styles.note}>
                This challan is cancelled. {challan.confirmed_at ? 'Any stock deducted at confirmation has been returned to inventory.' : ''}
              </p>
            )}
          </div>
        </Card>
      </div>

      {(challan.remarks || challan.status === 'CONFIRMED') && (
        <Card className={styles.metaCard}>
          {challan.remarks && (
            <p className={styles.remarks}>
              <strong>Remarks:</strong> {challan.remarks}
            </p>
          )}
          {challan.status === 'CONFIRMED' && (
            <Badge tone="success">Inventory deducted for this challan</Badge>
          )}
        </Card>
      )}

      <Card className={styles.itemsCard}>
        <Card.Header title="Items" description={`${items.length} product${items.length === 1 ? '' : 's'}`} />
        <DataTable columns={columns} data={items} rowKey={(row) => row.id} loading={false} emptyLabel="No items" />
        <div className={styles.footerTotal}>
          <span>Total</span>
          <span className="mono">{challan.total_quantity} units · {formatMoney(totalValue)}</span>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm challan?"
        description="Stock will be deducted immediately for every item on this challan. This cannot be undone except by cancelling the challan."
        confirmLabel="Confirm challan"
        tone="primary"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirm}
        loading={acting}
      />
      <ConfirmDialog
        open={cancelOpen}
        title="Cancel challan?"
        description={
          challan.status === 'CONFIRMED'
            ? 'Stock that was deducted will be returned to inventory.'
            : 'This draft challan will be marked as cancelled without any stock changes.'
        }
        confirmLabel="Cancel challan"
        tone="danger"
        onCancel={() => setCancelOpen(false)}
        onConfirm={cancel}
        loading={acting}
      />
    </div>
  );
}

function MetaRow({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className={styles.metaRow}>
      <dt>{label}</dt>
      <dd className={`${mono ? 'mono' : ''} ${strong ? styles.strongValue : ''}`}>{value}</dd>
    </div>
  );
}