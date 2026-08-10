import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { ApiError } from '../../types/api';
import type { Challan } from '../../types/domain';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { PageHeader } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { SearchIcon, PlusIcon, DocumentIcon } from '../../components/ui/Icons';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../utils/format';
import styles from './ChallansPage.module.css';

interface ListResponse {
  data: Challan[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function ChallansPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<Challan[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');

  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';
  const canCreate = can('ADMIN', 'SALES');

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
      const res = await api.get<ListResponse>('/challans', {
        page,
        limit: 10,
        search: search || undefined,
        status: status || undefined,
      });
      setRows(res.data!.data);
      setMeta(res.data!.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load challans');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

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

  const columns: Column<Challan>[] = [
    { key: 'number', header: 'Challan', render: (row) => <span className="mono font-medium">{row.challan_number}</span> },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div>
          <div className="font-medium">{row.customer_name ?? 'Unknown'}</div>
          {row.customer_business_name && <div className="text-muted">{row.customer_business_name}</div>}
        </div>
      ),
    },
    { key: 'qty', header: 'Qty', align: 'right', render: (row) => <span className="mono">{row.total_quantity}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
    { key: 'by', header: 'Created by', render: (row) => <span className="text-secondary">{row.created_by_name ?? '—'}</span> },
    { key: 'created', header: 'Created', render: (row) => <span className="text-secondary">{formatDateTime(row.created_at)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Sales Challans"
        description={`${meta.total} challan${meta.total === 1 ? '' : 's'} recorded`}
        actions={
          canCreate ? (
            <Button icon={<PlusIcon />} onClick={() => navigate('/challans/new')}>
              New challan
            </Button>
          ) : undefined
        }
      />

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <SearchIcon />
          <Input
            placeholder="Search challan number or customer…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search challans"
          />
        </div>
        <Select value={status} onChange={(event) => updateParams({ status: event.target.value })} className={styles.filterSelect}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>

      {error ? (
        <p className={styles.error}>{error}</p>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(row) => row.id}
          loading={loading}
          emptyLabel="No challans found"
          emptyDescription={
            search || status ? 'Try adjusting your search or filters.' : 'Create your first sales challan to get started.'
          }
          emptyIcon={<DocumentIcon />}
          onRowClick={(row) => navigate(`/challans/${row.id}`)}
          bottomContent={
            <Pagination page={page} totalPages={meta.totalPages} onPageChange={(next) => updateParams({ page: String(next) })} />
          }
        />
      )}
    </div>
  );
}