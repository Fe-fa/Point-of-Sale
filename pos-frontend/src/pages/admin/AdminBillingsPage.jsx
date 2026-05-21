import { useEffect, useState } from 'react';
import Modal from '../../components/common/Modal';
import { useStore } from '../../contexts/StoreContext';
import { billingService } from '../../services/billingService';
import { currency, formatDateTime } from '../../utils/helpers';
import { openBillingPrint } from '../../utils/print';

export default function AdminBillingsPage() {
  const { stores, storeId } = useStore();
  const currentStore = stores.find((store) => String(store.store_id) === String(storeId));

  const [billings, setBillings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [selectedBilling, setSelectedBilling] = useState(null);
  const [error, setError] = useState('');

  const loadBillings = async () => {
    if (!storeId) {
      setBillings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await billingService.list({ per_page: 100, status, store_id: storeId });
      setBillings(response.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load billing records.');
      setBillings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setBillings([]);
    setSelectedBilling(null);
    setError('');

    if (!storeId) {
      setLoading(false);
      return;
    }

    loadBillings();
  }, [storeId, status]);

  const openDetails = async (billingId) => {
    try {
      const response = await billingService.show(billingId);
      setSelectedBilling(response.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load billing detail.');
    }
  };

  return (
    <section className="stack-lg">
      <div className="section-header">
        <select
          className="select-input slim"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={!storeId}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>

        <div className="inventory-store-pill">Store ID: {storeId || '-'}</div>
      </div>

      <article className="card">
        <div className="card-header">
          <div>
            <h3>Billing records</h3>
            <p>{billings.length} items</p>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {!storeId ? (
                <tr><td colSpan="7">Select a store first.</td></tr>
              ) : loading ? (
                <tr><td colSpan="7">Loading...</td></tr>
              ) : billings.length ? (
                billings.map((billing) => (
                  <tr key={billing.billing_id}>
                    <td>{billing.invnumber || `Draft #${billing.billing_id}`}</td>
                    <td>{billing.customer?.full_name || 'Walk-in customer'}</td>
                    <td>{currency(billing.total, currentStore?.currency)}</td>
                    <td>{currency(billing.paid_amount, currentStore?.currency)}</td>
                    <td><span className={`status-badge ${billing.status}`}>{billing.status}</span></td>
                    <td>{formatDateTime(billing.billing_date)}</td>
                    <td>
                      <div className="row-actions compact">
                        <button className="ghost-button" onClick={() => openDetails(billing.billing_id)}>
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="7">No billings found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <Modal open={!!selectedBilling} title="Billing details" onClose={() => setSelectedBilling(null)} width="920px">
        {selectedBilling ? (
          <div className="stack-md">
            <div className="detail-grid">
              <div>
                <p className="muted">Invoice</p>
                <strong>{selectedBilling.invnumber || `Draft #${selectedBilling.billing_id}`}</strong>
              </div>
              <div>
                <p className="muted">Customer</p>
                <strong>{selectedBilling.customer?.full_name || 'Walk-in customer'}</strong>
              </div>
              <div>
                <p className="muted">Status</p>
                <strong>{selectedBilling.status}</strong>
              </div>
              <div>
                <p className="muted">Billing date</p>
                <strong>{formatDateTime(selectedBilling.billing_date)}</strong>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBilling.items?.map((item) => (
                    <tr key={item.billing_item_id}>
                      <td>{item.product?.product_name}</td>
                      <td>{item.quantity}</td>
                      <td>{currency(item.unit_price, currentStore?.currency)}</td>
                      <td>{currency(item.total_amount, currentStore?.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="billing-summary-grid">
              <div className="summary-box"><span>Subtotal</span><strong>{currency(selectedBilling.subtotal, currentStore?.currency)}</strong></div>
              <div className="summary-box"><span>VAT</span><strong>{currency(selectedBilling.vat_amount, currentStore?.currency)}</strong></div>
              <div className="summary-box"><span>Paid</span><strong>{currency(selectedBilling.paid_amount, currentStore?.currency)}</strong></div>
              <div className="summary-box"><span>Balance</span><strong>{currency(selectedBilling.balance_due, currentStore?.currency)}</strong></div>
            </div>

            <div className="row-actions">
              <button className="primary-button" onClick={() => openBillingPrint(selectedBilling, currentStore, 'invoice')}>
                Print invoice
              </button>
              <button className="ghost-button" onClick={() => openBillingPrint(selectedBilling, currentStore, 'receipt')}>
                Print receipt
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
