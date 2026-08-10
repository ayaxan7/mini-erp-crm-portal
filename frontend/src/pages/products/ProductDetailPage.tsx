import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { ApiError } from '../../types/api';
import type { Product, StockMovement, MovementType } from '../../types/domain';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { Badge } from '../../components/ui/Badge';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { formatDateTime } from '../../utils/format';
import { ArrowLeftIcon, PencilIcon } from '../../components/ui/Icons';
import { ProductFormModal } from './ProductFormModal';
import { SkeletonRows, ErrorState } from '../../components/ui/State';
import styles from './ProductDetail.module.css';

export function ProductDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [type, setType] = useState<MovementType>('IN');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [movError, setMovError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canManage = can('ADMIN', 'WAREHOUSE');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productRes, movementsRes] = await Promise.all([
        api.get<Product>(`/products/${id}`),
        api.get<{ data: StockMovement[] }>(`/products/${id}/movements`, { limit: 25 }),
      ]);
      setProduct(productRes.data!);
      setMovements(movementsRes.data!.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const adjustStock = async (event: FormEvent) => {
    event.preventDefault();
    const qty = Number(quantity);
    if (!quantity || Number.isNaN(qty) || qty <= 0) {
      setMovError('Enter a quantity greater than zero.');
      return;
    }
    setSaving(true);
    setMovError(null);
    try {
      await api.post<Product>(`/products/${id}/stock`, {
        type,
        quantity: qty,
        reason: reason.trim(),
      });
      toast.success(type === 'IN' ? 'Stock added' : 'Stock deducted');
      setQuantity('');
      setReason('');
      await load();
    } catch (err) {
      setMovError(err instanceof ApiError ? err.message : 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonRows rows={6} />;
  if (error || !product)
    return <ErrorState title="Could not load this product" description={error ?? 'Product not found.'} onRetry={() => void load()} />;

  const columns: Column<StockMovement>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (row) =>
        row.movement_type === 'IN' ? <Badge tone="success">Stock in</Badge> : <Badge tone="danger">Stock out</Badge>,
    },
    {
      key: 'qty',
      header: 'Qty',
      align: 'right',
      render: (row) => (
        <span className={`mono ${row.movement_type === 'OUT' ? styles.out : styles.in}`}>
          {row.movement_type === 'IN' ? '+' : '−'}
          {row.quantity_changed}
        </span>
      ),
    },
    { key: 'reason', header: 'Reason', render: (row) => <span className="text-secondary">{row.reason}</span> },
    {
      key: 'reference',
      header: 'Reference',
      render: (row) => (row.reference_type ? <span className="mono text-muted">{`${row.reference_type} #${row.reference_id}`}</span> : <span className="text-muted">—</span>),
    },
    { key: 'by', header: 'By', render: (row) => <span className="text-secondary">{row.created_by_name ?? '—'}</span> },
    { key: 'at', header: 'When', render: (row) => <span className="text-secondary">{formatDateTime(row.created_at)}</span> },
  ];

  return (
    <div>
      <button className={styles.back} onClick={() => navigate('/products')}>
        <ArrowLeftIcon /> Back to products
      </button>

      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>{product.name}</h1>
          <span className="mono text-muted">{product.sku}</span>
        </div>
        <div className={styles.titleActions}>
          <Badge tone={product.is_low_stock ? 'danger' : 'success'}>{product.is_low_stock ? 'Low stock' : 'In stock'}</Badge>
          {canManage && (
            <Button variant="secondary" icon={<PencilIcon />} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className={styles.statsRow}>
        <StockStat label="Units in stock" value={String(product.current_stock)} tone={product.is_low_stock ? 'danger' : 'normal'} />
        <StockStat label="Minimum stock" value={String(product.min_stock)} />
        <StockStat label="Storage" value={product.location || '—'} />
      </div>

      <div className={styles.grid}>
        <Card className={styles.infoCard}>
          <Card.Header title="Details" />
          <dl className={styles.detailList}>
            <DetailRow label="Category" value={product.category} />
            <DetailRow label="Created" value={formatDateTime(product.created_at)} />
            <DetailRow label="Last updated" value={formatDateTime(product.updated_at)} />
            <DetailRow label="Added by" value={product.created_by_name ?? '—'} />
          </dl>
        </Card>

        {canManage && (
          <Card className={styles.stockCard}>
            <Card.Header title="Adjust stock" />
            <form onSubmit={adjustStock} className={styles.stockForm} noValidate>
              <div className={styles.stockRow}>
                <Select value={type} onChange={(event) => setType(event.target.value as MovementType)} className={styles.typeSelect}>
                  <option value="IN">Add stock (IN)</option>
                  <option value="OUT">Remove stock (OUT)</option>
                </Select>
                <Field label="Quantity" className={styles.qtyField}>
                  <Input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} invalid={Boolean(movError)} />
                </Field>
              </div>
              <Field label="Reason" required error={movError ?? undefined}>
                <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={type === 'IN' ? 'e.g. Purchase restock' : 'e.g. Damage, expiry'} invalid={Boolean(movError)} />
              </Field>
              <Button type="submit" loading={saving} disabled={!reason.trim()}>
                {type === 'IN' ? 'Add stock' : 'Remove stock'}
              </Button>
            </form>
          </Card>
        )}
      </div>

      <Card className={styles.movementsCard}>
        <Card.Header title="Movement history" description="Latest 25 stock movements" />
        <DataTable
          columns={columns}
          data={movements}
          rowKey={(row) => row.id}
          loading={false}
          emptyLabel="No movements yet"
          emptyDescription="Stock adjustments will appear here."
        />
      </Card>

      <ProductFormModal
        open={editOpen}
        product={product}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          setEditOpen(false);
          setProduct(updated);
          toast.success('Product updated');
        }}
      />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailRow}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function StockStat({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'danger' }) {
  return (
    <div className={styles.stockStat}>
      <span className={styles.stockStatLabel}>{label}</span>
      <span className={`${styles.stockStatValue} ${tone === 'danger' ? styles.dangerText : ''}`}>{value}</span>
    </div>
  );
}