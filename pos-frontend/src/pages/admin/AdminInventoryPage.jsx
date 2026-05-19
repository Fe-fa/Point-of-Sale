import { Edit, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { inventoryService } from '../../services/inventoryService';
import { productService } from '../../services/productService';
import { useStore } from '../../contexts/StoreContext';

const initialForm = { product_id: '', quantity: '', reorder_level: 0 };

const extractList = (res) => {
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
};

const getInventoryStatus = (row) => {
  const quantity = Number(row?.quantity || 0);
  const reorder = Number(row?.reorder_level || 0);
  if (quantity <= 0) return { label: 'Out of stock', tone: 'out' };
  if ((reorder > 0 && quantity <= reorder) || quantity <= 12) {
    return { label: 'Low stock', tone: 'low' };
  }
  return { label: 'In stock', tone: 'normal' };
};

export default function AdminInventoryPage() {
  const { storeId } = useStore();
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [inventoryRes, productsRes] = await Promise.all([
        inventoryService.list({ store_id: storeId, per_page: 100 }),
        productService.list({ per_page: 100 }),
      ]);
      setRows(extractList(inventoryRes));
      setProducts(extractList(productsRes));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to load inventory.');
      setRows([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) load();
  }, [storeId]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => {
      const name = row?.product?.product_name?.toLowerCase() || '';
      const sku = row?.product?.sku?.toLowerCase() || '';
      return name.includes(keyword) || sku.includes(keyword);
    });
  }, [rows, search]);

  const lowStockCount = useMemo(
    () => rows.filter((row) => getInventoryStatus(row).tone === 'low').length,
    [rows]
  );

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setError('');
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        store_id: Number(storeId),
        product_id: Number(form.product_id),
        quantity: Number(form.quantity),
        reorder_level: Number(form.reorder_level || 0),
      };
      if (editingId) await inventoryService.update(editingId, payload);
      else await inventoryService.create(payload);
      setShowModal(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to save inventory.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (row) => {
    setEditingId(row.inventory_id);
    setForm({
      product_id: row.product_id,
      quantity: row.quantity,
      reorder_level: row.reorder_level || 0,
    });
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (inventoryId) => {
    if (!window.confirm('Delete this inventory row? Quantity must be zero.')) return;
    try {
      await inventoryService.remove(inventoryId);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to delete inventory.');
    }
  };

  return (
    <>
      <section className="inventory-page stack-lg">
<div className="catalog-hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
  <div className="catalog-hero-copy" style={{ display: 'flex', flexDirection: 'column' }}>
    <h2 className="catalog-title">Inventory</h2>
    <p className="catalog-subtitle">
      {rows.length} stock lines
      {lowStockCount ? ` • ${lowStockCount} low stock` : ''}
    </p>
  </div>

  <button type="button" className="ghost-button" onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
    <Plus size={16} />
    <span>Add stock line</span>
  </button>
</div>

        <div className="catalog-toolbar">
          <label className="catalog-search">
            <span className="catalog-search-icon">
              <Search size={16} />
            </span>
            <input
              type="text-input"
              placeholder="Search stock"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <div className="inventory-store-pill">Store ID: {storeId || '-'}</div>
        </div>

        {error && !showModal ? <p className="form-error">{error}</p> : null}

        <article className="catalog-table-card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Reorder level</th>
                  <th>Status</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="catalog-empty-cell">Loading...</td></tr>
                ) : filteredRows.length ? (
                  filteredRows.map((row) => {
                    const status = getInventoryStatus(row);
                    return (
                      <tr key={row.inventory_id}>
                        <td>
                          <div className="catalog-item-copy">
                            <strong>{row.product?.product_name || 'Unknown product'}</strong>
                            <span>{row.product?.sku || 'No SKU'}</span>
                          </div>
                        </td>
                        <td>{row.quantity}</td>
                        <td>{row.reorder_level || 0}</td>
                        <td><span className={`stock-pill ${status.tone}`}>{status.label}</span></td>
                        <td>
                          <div className="catalog-action-group">
                            <button type="button" className="catalog-icon-btn" onClick={() => handleEdit(row)} title="Edit">
                              <Edit size={16} />
                            </button>
                            <button type="button" className="catalog-icon-btn danger" onClick={() => handleDelete(row.inventory_id)} title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan="5" className="catalog-empty-cell">No inventory rows found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {showModal ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card form-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{editingId ? 'Update stock' : 'Add stock line'}</h3>
                <p className="muted">Adjust store quantity and reorder threshold.</p>
              </div>
              <button type="button" className="icon-button" onClick={closeModal} disabled={submitting}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-content">
              <form className="catalog-form-grid" onSubmit={handleSubmit}>
                <label className="span-2">
                  Product
                  <select
                    className="select-input"
                    value={form.product_id}
                    onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                    required
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.product_id} value={product.product_id}>
                        {product.product_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Quantity
                  <input
                    className="text-input"
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    required
                  />
                </label>

                <label>
                  Reorder level
                  <input
                    className="text-input"
                    type="number"
                    min="0"
                    value={form.reorder_level}
                    onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                  />
                </label>

                {error ? <p className="form-error span-2">{error}</p> : null}

                <div className="catalog-modal-actions span-2">
                  <button type="button" className="ghost-button" onClick={closeModal} disabled={submitting}>
                    Cancel
                  </button>
                  <button className="catalog-primary-btn" type="submit" disabled={submitting}>
                    {editingId ? 'Update inventory' : 'Create inventory'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
