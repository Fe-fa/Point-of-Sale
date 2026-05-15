import { useEffect, useMemo, useState } from 'react';
import { billingService } from '../../services/billingService';
import { customerService } from '../../services/customerService';
import { inventoryService } from '../../services/inventoryService';
import { productService } from '../../services/productService';
import { currency, formatDateTime } from '../../utils/helpers';
import { useStore } from '../../contexts/StoreContext';

function MetricCard({ label, value, caption }) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <h3>{value}</h3>
      <span>{caption}</span>
    </article>
  );
}

export default function AdminDashboardPage() {
  const { stores, storeId } = useStore();
  const currentStore = stores.find((store) => String(store.store_id) === String(storeId));
  const [stats, setStats] = useState({
    products: 0,
    inventory: 0,
    customers: 0,
    billings: 0,
    revenue: 0,
    recent: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
        const [productsRes, inventoryRes, customersRes, billingsRes] = await Promise.all([
          productService.list({ per_page: 100 }),
          inventoryService.list({ per_page: 100, store_id: storeId }),
          customerService.list({ per_page: 100 }),
          billingService.list({ per_page: 100 }),
        ]);

        const billings = billingsRes.data?.data || [];
        const paidRevenue = billings.filter((item) => item.status === 'paid' || item.status === 'partial')
          .reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);

        setStats({
          products: productsRes.data?.total || (productsRes.data?.data || []).length,
          inventory: inventoryRes.data?.total || (inventoryRes.data?.data || []).length,
          customers: customersRes.data?.total || (customersRes.data?.data || []).length,
          billings: billingsRes.data?.total || billings.length,
          revenue: paidRevenue,
          recent: billings.slice(0, 8),
        });
      } finally {
        setLoading(false);
      }
    }

    if (storeId) loadDashboard();
  }, [storeId]);

  const lowStock = useMemo(() => {
    return stats.recent.filter((item) => Number(item.balance_due || 0) > 0).length;
  }, [stats.recent]);

  if (loading) return <div className="page-loader">Loading dashboard...</div>;

  return (
    <section className="stack-lg">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Overview</span>
          <h2>{currentStore?.store_name || 'Store'} performance</h2>
          <p>Track live sales, inventory status, billing activity, and customer growth from one dashboard.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <MetricCard label="Products" value={stats.products} caption="Active catalog records" />
        <MetricCard label="Inventory rows" value={stats.inventory} caption="Store stock lines" />
        <MetricCard label="Customers" value={stats.customers} caption="Saved customer profiles" />
        <MetricCard label="Collected" value={currency(stats.revenue, currentStore?.currency)} caption="Paid and partial billings" />
      </div>

      <div className="dashboard-grid">
        <article className="card">
          <div className="card-header">
            <div>
              <h3>Billing pulse</h3>
              <p>{stats.billings} billing records, {lowStock} still unpaid or partially paid.</p>
            </div>
          </div>
          <div className="list-stack">
            {stats.recent.length ? stats.recent.map((billing) => (
              <div key={billing.billing_id} className="list-row">
                <div>
                  <strong>{billing.invnumber || `Draft #${billing.billing_id}`}</strong>
                  <p>{billing.customer?.full_name || 'Walk-in customer'}</p>
                </div>
                <div className="align-right">
                  <strong>{currency(billing.total, currentStore?.currency)}</strong>
                  <p>{formatDateTime(billing.billing_date)}</p>
                </div>
              </div>
            )) : <p className="muted">No billing activity yet.</p>}
          </div>
        </article>
      </div>
    </section>
  );
}
