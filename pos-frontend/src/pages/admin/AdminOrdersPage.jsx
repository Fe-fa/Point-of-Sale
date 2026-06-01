import { useEffect, useState } from 'react';
import Modal from '../../components/common/Modal';
import { useStore } from '../../contexts/StoreContext';
import { billingService } from '../../services/billingService';
import { formatDateTime } from '../../utils/helpers';

const emptyPagination = {
  data: [],
  current_page: 1,
  per_page: 10,
  prev_page_url: null,
  next_page_url: null,
  from: null,
  to: null,
};

const extractPagination = (response) => {
  const payload = response?.data ?? response ?? {};

  if (Array.isArray(payload?.data)) {
    return { ...emptyPagination, ...payload, data: payload.data };
  }

  if (Array.isArray(payload)) {
    return {
      ...emptyPagination,
      data: payload,
      per_page: payload.length,
      from: payload.length ? 1 : null,
      to: payload.length || null,
    };
  }

  return emptyPagination;
};

const fulfillmentStatusOptions = [
  { value: '', label: 'All fulfillment statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
];

const fulfillmentTypeOptions = [
  { value: '', label: 'All fulfillment types' },
  { value: 'walk_in_counter', label: 'Walk-in Counter' },
  { value: 'delivery', label: 'Delivery' },
];

const detailFulfillmentStatusOptions = fulfillmentStatusOptions.filter((option) => option.value);
const detailFulfillmentTypeOptions = fulfillmentTypeOptions.filter((option) => option.value);

const getOrderNumber = (order) => {
  if (order?.order_number) return order.order_number;
  return `ORD-${String(order?.billing_id || 0).padStart(4, '0')}`;
};

const getItemsCount = (order) => {
  if (order?.items_sum_quantity !== undefined && order?.items_sum_quantity !== null) {
    return Number(order.items_sum_quantity || 0);
  }

  if (Array.isArray(order?.items)) {
    return order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }

  return Number(order?.items_count || 0);
};

const getItemsCountLabel = (order) => {
  const count = getItemsCount(order);
  return `${count} ${count === 1 ? 'item' : 'items'}`;
};

const formatFulfillmentType = (value) => {
  if (value === 'walk_in_counter') return 'Walk-in Counter';
  if (value === 'delivery') return 'Delivery';
  return 'Walk-in Counter';
};

const renderFulfillmentBadge = (value) => {
  const badgeMap = {
    pending: 'warning',
    processing: 'partial',
    shipped: 'unpaid',
    delivered: 'paid',
  };

  const badgeClass = badgeMap[value] || 'warning';

  return <span className={`status-badge ${badgeClass}`}>{value || 'pending'}</span>;
};

export default function AdminOrdersPage() {
  const { stores, storeId } = useStore();
  const currentStore = stores.find((store) => String(store.store_id) === String(storeId));

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fulfillmentStatus, setFulfillmentStatus] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingFulfillment, setSavingFulfillment] = useState(false);

  const loadOrders = async () => {
    if (!storeId) {
      setOrders([]);
      setPagination(emptyPagination);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = {
        page,
        per_page: 10,
        store_id: storeId,
      };

      if (fulfillmentStatus) {
        params.fulfillment_status = fulfillmentStatus;
      }

      if (fulfillmentType) {
        params.fulfillment_type = fulfillmentType;
      }

      const response = await billingService.list(params);
      const parsed = extractPagination(response);

      setPagination(parsed);
      setOrders(parsed.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load orders.');
      setOrders([]);
      setPagination(emptyPagination);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setOrders([]);
    setSelectedOrder(null);
    setError('');
    setSuccess('');

    if (!storeId) {
      setLoading(false);
      return;
    }

    loadOrders();
  }, [storeId, page, fulfillmentStatus, fulfillmentType]);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(() => {
      setSuccess('');
    }, 4000);

    return () => clearTimeout(timer);
  }, [success]);

  const openDetails = async (billingId) => {
    setError('');

    try {
      const response = await billingService.show(billingId);
      setSelectedOrder(response?.data || response || null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load order detail.');
    }
  };

  const closeDetails = () => {
    setSelectedOrder(null);
  };

  const handleSaveFulfillment = async () => {
    if (!selectedOrder?.billing_id) return;

    setSavingFulfillment(true);
    setError('');
    setSuccess('');

    try {
      const response = await billingService.update(selectedOrder.billing_id, {
        fulfillment_status: selectedOrder.fulfillment_status || 'pending',
        fulfillment_type: selectedOrder.fulfillment_type || 'walk_in_counter',
      });

      const updatedOrder = response?.data || response;

      setSelectedOrder((prev) => ({
        ...prev,
        ...updatedOrder,
      }));

      setOrders((prev) =>
        prev.map((order) =>
          String(order.billing_id) === String(updatedOrder.billing_id)
            ? { ...order, ...updatedOrder }
            : order
        )
      );

      setSuccess('Order fulfillment updated successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to update fulfillment.');
    } finally {
      setSavingFulfillment(false);
    }
  };

  return (
    <section className="stack-lg">
      <div className="section-header" style={{ justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2>Orders</h2>
          <p>
            Operations and fulfillment view for warehouse or counter staff. Track physical items,
            order routing, and fulfillment progress without exposing billing totals and balances.
          </p>
        </div>

        <div className="row-actions compact" style={{ flexWrap: 'wrap' }}>
          <select
            className="select-input slim"
            value={fulfillmentStatus}
            onChange={(e) => {
              setFulfillmentStatus(e.target.value);
              setPage(1);
            }}
            disabled={!storeId}
          >
            {fulfillmentStatusOptions.map((option) => (
              <option key={option.value || 'all-status'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            className="select-input slim"
            value={fulfillmentType}
            onChange={(e) => {
              setFulfillmentType(e.target.value);
              setPage(1);
            }}
            disabled={!storeId}
          >
            {fulfillmentTypeOptions.map((option) => (
              <option key={option.value || 'all-type'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="inventory-store-pill">Store ID: {storeId || '-'}</div>
        </div>
      </div>

      <article className="card">
        <div className="card-header">
          <div>
            <h3>Order records</h3>
            <p>
              {pagination.from && pagination.to
                ? `Showing ${pagination.from}-${pagination.to}`
                : `${orders.length} items`}
            </p>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="form-success">{success}</p> : null}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items Count</th>
                <th>Fulfillment Type</th>
                <th>Fulfillment Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {!storeId ? (
                <tr>
                  <td colSpan="7">Select a store first.</td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan="7">Loading...</td>
                </tr>
              ) : orders.length ? (
                orders.map((order) => (
                  <tr key={order.billing_id}>
                    <td>{getOrderNumber(order)}</td>
                    <td>{order.customer?.full_name || 'Walk-in customer'}</td>
                    <td>{getItemsCountLabel(order)}</td>
                    <td>{formatFulfillmentType(order.fulfillment_type)}</td>
                    <td>{renderFulfillmentBadge(order.fulfillment_status || 'pending')}</td>
                    <td>{order.billing_date ? formatDateTime(order.billing_date) : '-'}</td>
                    <td>
                      <div className="row-actions compact">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => openDetails(order.billing_id)}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7">No orders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {storeId ? (
          <div
            className="row-actions"
            style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}
          >
            <span className="muted">Page {pagination.current_page || page}</span>

            <div className="row-actions compact">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={!pagination.prev_page_url || loading}
              >
                Previous
              </button>

              <button
                type="button"
                className="ghost-button"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={!pagination.next_page_url || loading}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </article>

      <Modal
        open={!!selectedOrder}
        title="Order details"
        onClose={closeDetails}
        width="920px"
      >
        {selectedOrder ? (
          <div className="stack-md">
            <div className="detail-grid">
              <div>
                <p className="muted">Order</p>
                <strong>{getOrderNumber(selectedOrder)}</strong>
              </div>

              <div>
                <p className="muted">Customer</p>
                <strong>{selectedOrder.customer?.full_name || 'Walk-in customer'}</strong>
              </div>

              <div>
                <p className="muted">Items Count</p>
                <strong>{getItemsCountLabel(selectedOrder)}</strong>
              </div>

              <div>
                <p className="muted">Order date</p>
                <strong>
                  {selectedOrder.billing_date ? formatDateTime(selectedOrder.billing_date) : '-'}
                </strong>
              </div>

              <div>
                <p className="muted">Fulfillment status</p>
                <select
                  className="select-input"
                  value={selectedOrder.fulfillment_status || 'pending'}
                  onChange={(e) =>
                    setSelectedOrder((prev) => ({
                      ...prev,
                      fulfillment_status: e.target.value,
                    }))
                  }
                >
                  {detailFulfillmentStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="muted">Fulfillment type</p>
                <select
                  className="select-input"
                  value={selectedOrder.fulfillment_type || 'walk_in_counter'}
                  onChange={(e) =>
                    setSelectedOrder((prev) => ({
                      ...prev,
                      fulfillment_type: e.target.value,
                    }))
                  }
                >
                  {detailFulfillmentTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="muted">Stock applied</p>
                <strong>
                  {selectedOrder.stock_applied_at
                    ? formatDateTime(selectedOrder.stock_applied_at)
                    : '-'}
                </strong>
              </div>

              <div>
                <p className="muted">Financial reference</p>
                <strong>{selectedOrder.invnumber || '-'}</strong>
              </div>
            </div>

            {selectedOrder.notes ? (
              <div className="card" style={{ padding: '12px 16px' }}>
                <p className="muted">Operational notes</p>
                <strong>{selectedOrder.notes}</strong>
              </div>
            ) : null}

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.length ? (
                    selectedOrder.items.map((item) => (
                      <tr key={item.billing_item_id}>
                        <td>{item.product?.product_name || '-'}</td>
                        <td>{item.quantity}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2">No items found for this order.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="row-actions">
              <button
                className="primary-button"
                onClick={handleSaveFulfillment}
                disabled={savingFulfillment}
              >
                {savingFulfillment ? 'Saving...' : 'Save fulfillment'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
