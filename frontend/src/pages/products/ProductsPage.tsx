import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, uploadImage } from '../../services/api';
import { ApiError } from '../../types/api';
import type { Product } from '../../types/domain';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { PageHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SearchIcon, PlusIcon, BoxIcon, ImageIcon } from '../../components/ui/Icons';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../utils/format';
import { ProductFormModal } from './ProductFormModal';
import styles from './ProductsPage.module.css';

interface ListResponse {
  data: Product[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function ProductsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<Product[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [uploadTarget, setUploadTarget] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') ?? '';
  const lowStock = searchParams.get('lowStock') === '1';
  const canManage = can('ADMIN', 'WAREHOUSE');

  const debouncedSearch = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(debouncedSearch.current);
    debouncedSearch.current = window.setTimeout(() => {
      updateParams({ search: searchInput });
    }, 400);
    return () => window.clearTimeout(debouncedSearch.current);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ListResponse>('/products', {
        page,
        limit: 10,
        search: search || undefined,
        lowStock: lowStock ? 1 : undefined,
      });
      setRows(res.data!.data);
      setMeta(res.data!.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [page, search, lowStock]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      next.delete('page');
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const handleUploadClick = (row: Product) => {
    setError(null);
    setUploadTarget(row);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadTarget) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Only PNG, JPEG or WebP images are allowed');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const res = await uploadImage<Product>(`/products/${uploadTarget.id}/image`, file);
      const updated = res.data!;
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Image upload failed');
    } finally {
      setUploading(false);
      setUploadTarget(null);
    }
  };

  const columns: Column<Product>[] = [
    {
      key: 'image',
      header: '',
      render: (row) => (
        <div className={styles.thumbWrap}>
          {row.image_url ? (
            <img className={styles.thumb} src={row.image_url} alt={row.name} />
          ) : (
            <span className={`${styles.thumb} ${styles.thumbEmpty}`}>
              <ImageIcon width={16} height={16} />
            </span>
          )}
          {canManage ? (
            <button
              type="button"
              className={styles.thumbBtn}
              aria-label={`Upload image for ${row.name}`}
              disabled={uploading}
              onClick={(event) => {
                event.stopPropagation();
                handleUploadClick(row);
              }}
            >
              <ImageIcon width={14} height={14} />
            </button>
          ) : null}
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Product',
      render: (row) => (
        <div className={styles.productCell}>
          <span className={styles.productName}>{row.name}</span>
          <span className="mono text-muted">{row.sku}</span>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (row) => <span className="text-secondary">{row.category}</span> },
    {
      key: 'price',
      header: 'Unit price',
      align: 'right',
      render: (row) => <span className="mono">{formatMoney(row.unit_price)}</span>,
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      render: (row) => (
        <span className={`mono ${row.is_low_stock ? styles.low : ''}`}>
          {row.current_stock}
        </span>
      ),
    },
    { key: 'min', header: 'Min', align: 'right', render: (row) => <span className="mono text-muted">{row.min_stock}</span> },
    { key: 'flag', header: 'Status', render: (row) => (row.is_low_stock ? <Badge tone="danger">Low stock</Badge> : <Badge tone="success">OK</Badge>) },
  ];

  return (
    <div>
      <PageHeader
        title="Products & Inventory"
        description={`${meta.total} product${meta.total === 1 ? '' : 's'} tracked`}
        actions={
          canManage ? (
            <Button icon={<PlusIcon />} onClick={() => setFormOpen(true)}>
              Add product
            </Button>
          ) : undefined
        }
      />

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <SearchIcon />
          <Input
            placeholder="Search name or SKU…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search products"
          />
        </div>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(event) => updateParams({ lowStock: event.target.checked ? '1' : '', page: '' })}
          />
          Low stock only
        </label>
      </div>

      {error ? (
        <p className={styles.error}>{error}</p>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(row) => row.id}
          loading={loading}
          emptyLabel="No products found"
          emptyDescription={
            search || lowStock ? 'Try adjusting your search or filters.' : 'Add your first product to start tracking inventory.'
          }
          emptyIcon={<BoxIcon />}
          onRowClick={(row) => navigate(`/products/${row.id}`)}
          bottomContent={
            <Pagination page={page} totalPages={meta.totalPages} onPageChange={(next) => updateParams({ page: String(next) })} />
          }
        />
      )}

      <ProductFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          void load();
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className={styles.hiddenInput}
        onChange={(event) => void handleFileChange(event)}
      />
    </div>
  );
}