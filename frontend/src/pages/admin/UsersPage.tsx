import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { ApiError } from '../../types/api';
import type { AppUser, Role } from '../../types/domain';
import { ROLE_OPTIONS } from '../../types/domain';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { PageHeader, Card } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Field';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { SearchIcon, ShieldIcon } from '../../components/ui/Icons';
import { formatDate } from '../../utils/format';
import styles from './UsersPage.module.css';

interface ListResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [rows, setRows] = useState<AppUser[]>([]);
  const [meta, setMeta] = useState<ListResponse<AppUser>['meta']>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changingId, setChangingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ListResponse<AppUser>>('/auth/users', { search: search || undefined, page, limit: 10 });
      setRows(res.data!.data);
      setMeta(res.data!.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load users');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeRole = useCallback(async (row: AppUser, role: Role) => {
    if (role === row.role) return;
    setChangingId(row.id);
    try {
      await api.patch<AppUser>(`/auth/users/${row.id}/role`, { role });
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, role } : item)));
      toastSuccess(`Role updated to ${role} for ${row.name}`);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Could not update role');
    } finally {
      setChangingId(null);
    }
  }, [toastSuccess, toastError]);

  const columns = useMemo<Column<AppUser>[]>(() => [
    { key: 'name', header: 'User', render: (row) => (
      <div className={styles.userCell}>
        <span className={styles.userName}>{row.name}</span>
        <span className="mono text-muted">{row.email}</span>
      </div>
    ) },
    { key: 'role', header: 'Role', render: (row) => (
      <Select
        value={row.role}
        className={styles.roleSelect + ' ' + styles[`role-${row.role}`]}
        disabled={row.id === currentUser?.id || changingId === row.id}
        onChange={(event) => void changeRole(row, event.target.value as Role)}
        aria-label={`Role for ${row.name}`}
      >
        {ROLE_OPTIONS.map((roleItem) => (
          <option key={roleItem} value={roleItem}>{roleItem}</option>
        ))}
      </Select>
    ) },
    { key: 'access', header: 'Access', render: (row) => (
      row.role === 'ADMIN'
        ? <Badge tone="danger">Full access</Badge>
        : <Badge tone={ROLE_TONES[row.role]}>{roleCapability(row.role)}</Badge>
    ) },
    { key: 'joined', header: 'Joined', render: (row) => (
      <span className="text-secondary">{formatDate(row.created_at)}</span>
    ) },
    { key: 'self', header: '', render: (row) =>
      row.id === currentUser?.id ? <span className={styles.selfBadge}>You</span> : <span className={styles.spacer} /> },
  ], [currentUser, changingId, changeRole]);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Users & roles"
        description="Manage who can access the portal and what each person can do."
      />

      <Card>
        <Card.Header title="Team members" description={`${meta.total} registered user${meta.total === 1 ? '' : 's'}`} />

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <SearchIcon />
            <Input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search name or email…"
              aria-label="Search users"
            />
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <DataTable
          columns={columns}
          data={rows}
          rowKey={(row) => row.id}
          loading={loading}
          emptyIcon={<ShieldIcon />}
          emptyLabel="No users found"
          emptyDescription="People sign in via Firebase and appear here automatically."
          bottomContent={
            <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={(next) => setPage(next)} />
          }
        />
      </Card>
    </div>
  );
}

function roleCapability(role: Exclude<Role, 'ADMIN'>): string {
  switch (role) {
    case 'SALES':
      return 'Customers, CRM, challans';
    case 'WAREHOUSE':
      return 'Products, stock, challans';
    case 'ACCOUNTS':
      return 'View-only';
  }
}

const ROLE_TONES: Record<Exclude<Role, 'ADMIN'>, 'success' | 'warning' | 'neutral'> = {
  SALES: 'success',
  WAREHOUSE: 'warning',
  ACCOUNTS: 'neutral',
};