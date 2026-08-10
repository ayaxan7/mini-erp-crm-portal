import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { ApiError } from '../../types/api';
import type { Customer } from '../../types/domain';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { PageHeader } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { SearchIcon, PlusIcon, UsersIcon } from '../../components/ui/Icons';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/format';
import { CustomerFormModal } from './CustomerFormModal';
import styles from './CustomersPage.module.css';

interface ListResponse {
  data: Customer[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function CustomersPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<Customer[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');

  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') ?? '';
  const type = searchParams.get('type') ?? '';
  const status = searchParams.get('status') ?? '';
  const canManage = can('ADMIN', 'SALES');

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
      const res = await api.get<ListResponse>('/customers', {
        page,
        limit: 10,
        search: search || undefined,
        type: type || undefined,
        status: status || undefined,
      });
      setRows(res.data!.data);
      setMeta(res.data!.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [page, search, type, status]);

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

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer',
      render: (row) => (
        <div className={styles.customerCell}>
          <span className={styles.customerName}>{row.name}</span>
          {row.business_name && <span className={styles.customerBusiness}>{row.business_name}</span>}
        </div>
      ),
    },
    { key: 'mobile', header: 'Mobile', render: (row) => <span className="mono">{row.mobile}</span> },
    { key: 'type', header: 'Type', render: (row) => <StatusBadge value={row.type} /> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
    { key: 'follow', header: 'Follow-up', render: (row) => <span className="text-secondary">{formatDate(row.follow_up_date)}</span> },
    { key: 'created', header: 'Created', render: (row) => <span className="text-secondary">{formatDate(row.created_at)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        description={`${meta.total} customer${meta.total === 1 ? '' : 's'} in your CRM`}
        actions={
          canManage ? (
            <Button icon={<PlusIcon />} onClick={() => setFormOpen(true)}>
              Add customer
            </Button>
          ) : undefined
        }
      />

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <SearchIcon />
          <Input
            placeholder="Search name, business or mobile…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search customers"
          />
        </div>
        <Select value={type} onChange={(event) => updateParams({ type: event.target.value })} className={styles.filterSelect}>
          <option value="">All types</option>
          <option value="RETAIL">Retail</option>
          <option value="WHOLESALE">Wholesale</option>
          <option value="DISTRIBUTOR">Distributor</option>
        </Select>
        <Select value={status} onChange={(event) => updateParams({ status: event.target.value })} className={styles.filterSelect}>
          <option value="">All statuses</option>
          <option value="LEAD">Lead</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
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
          emptyLabel="No customers found"
          emptyDescription={
            search || type || status ? 'Try adjusting your search or filters.' : 'Add your first customer to get started.'
          }
          emptyIcon={<UsersIcon />}
          onRowClick={(row) => navigate(`/customers/${row.id}`)}
          bottomContent={
            <Pagination page={page} totalPages={meta.totalPages} onPageChange={(next) => updateParams({ page: String(next) })} />
          }
        />
      )}

      <CustomerFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          void load();
        }}
      />
    </div>
  );
}