import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { ApiError } from '../types/api';
import type { DashboardSummary } from '../types/domain';
import { StatCard, Card, PageHeader } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { Spinner, ErrorState } from '../components/ui/State';
import { BoxIcon, UsersIcon, AlertIcon, DocumentIcon, BadgeDollarIcon } from '../components/ui/Icons';
import { formatMoneyCompact } from '../utils/format';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      setError(null);
      api.get<DashboardSummary>('/dashboard/summary')
        .then((res) => {
          if (!cancelled) setSummary(res.data!);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load dashboard');
        });
    };

    load();

    const onFocus = () => load();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) load();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  if (error) {
    return <ErrorState description={error} onRetry={() => location.reload()} />;
  }

  if (!summary) {
    return <Spinner label="Loading dashboard…" />;
  }

  const maxMonthly = Math.max(1, ...summary.monthlyChallans.map((entry) => entry.count));

  return (
    <div>
      <PageHeader title="Dashboard" description="A quick look at your operations today." />

      <div className={styles.stats}>
        <StatCard label="Customers" value={summary.customers.total} icon={<UsersIcon />} tone="primary" />
        <StatCard label="Active customers" value={summary.customers.active} icon={<UsersIcon />} tone="success" />
        <StatCard label="Overdue follow-ups" value={summary.customers.overdueFollowups} icon={<AlertIcon />} tone="warning" />
        <StatCard label="Products" value={summary.products.total} icon={<BoxIcon />} tone="info" />
        <StatCard label="Low stock items" value={summary.products.lowStock} icon={<AlertIcon />} tone="danger" />
        <StatCard
          label="Stock value"
          value={formatMoneyCompact(summary.products.stockValue)}
          icon={<BadgeDollarIcon />}
          tone="success"
        />
        <StatCard label="Challans (last 6 mo)" value={summary.challans.total} icon={<DocumentIcon />} tone="primary" />
      </div>

      <div className={styles.grid}>
        <Card className={styles.chartCard}>
          <div className={styles.cardHead}>
            <h3>Challans — last 6 months</h3>
          </div>
          {summary.monthlyChallans.length === 0 ? (
            <p className="text-secondary">No challans recorded yet.</p>
          ) : (
            <div className={styles.chart}>
              {summary.monthlyChallans.map((entry) => (
                <div key={entry.label} className={styles.barCol}>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.bar}
                      style={{ height: `${Math.max(6, (entry.count / maxMonthly) * 100)}%` }}
                    />
                  </div>
                  <span className={styles.barLabel}>{entry.label}</span>
                  <span className={styles.barValue}>{entry.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className={styles.recentCard}>
          <div className={styles.cardHead}>
            <h3>Recent challans</h3>
            <Link to="/challans" className={styles.seeAll}>
              View all
            </Link>
          </div>
          <div className={styles.recentList}>
            {summary.recentChallans.length === 0 ? (
              <p className="text-secondary">No challans yet.</p>
            ) : (
              summary.recentChallans.map((challan) => (
                <Link key={challan.id} to={`/challans/${challan.id}`} className={styles.recentRow}>
                  <div>
                    <span className={styles.challanMeta}>{challan.challan_number}</span>
                    <span className={styles.customer}>{challan.customer_name ?? 'Unknown customer'}</span>
                  </div>
                  <div className={styles.recentRight}>
                    <span className={styles.qty}>{challan.total_quantity} qty</span>
                    <StatusBadge value={challan.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      {summary.lowStockProducts.length > 0 && (
        <Card className={styles.lowStockCard}>
          <div className={styles.cardHead}>
            <h3>Stock alerts</h3>
            <Link to="/products?lowStock=1" className={styles.seeAll}>
              View products
            </Link>
          </div>
          <div className={styles.lowStockGrid}>
            {summary.lowStockProducts.map((product) => (
              <Link key={product.id} to={`/products/${product.id}`} className={styles.lowRow}>
                <span className={styles.lowName}>{product.name}</span>
                <span className="mono text-muted">{product.sku}</span>
                <span className={styles.lowQty}>
                  {product.current_stock} / {product.min_stock}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}