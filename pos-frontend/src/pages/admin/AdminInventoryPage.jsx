import { useEffect, useState } from 'react';
import { inventoryService } from '../../services/inventoryService';
import { productService } from '../../services/productService';
import { useStore } from '../../contexts/StoreContext';

const initialForm = { product_id: '', quantity: '', reorder_level: 0 };

export default function AdminInventoryPage() {
  const { storeId } = useStore();
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [inventoryRes, productsRes] = await Promise.all([
        inventoryService.list({ store_id: storeId, per_page: 100 }),
        productService.list({ per_page: 100 }),
      ]);
      setRows(inventoryRes.data?.data || []);
      setProducts(productsRes.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (storeId) load(); }, [storeId]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        store_id: Number(storeId),
        product_id: Number(form.product_id),
        quantity: Number(form.quantity),
        reorder_level: Number(form.reorder_level || 0),
      };
      if (editingId) await inventoryService.update(editingId, payload);
      else await inventoryService.create(payload);
      resetForm();
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to save inventory.');
    }
  };

  const handleEdit = (row) => {
    setEditingId(row.inventory_id);
    setForm({
      product_id: row.product_id,
      quantity: row.quantity,
      reorder_level: row.reorder_level || 0,
    });
  };

  const handleDelete = async (inventoryId) => {
    if (!window.confirm('Delete this inventory row? Quantity must be zero.')) return;
    try {
      await inventoryService.remove(inventoryId);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to delete inventory.');
    }
  };

  return (
    <section className="stack-lg">
      <div className="section-header">
        <div>
          <h2>Inventory</h2>
          <p>Stock levels update here and automatically reduce after cashier payment finalizes a billing.</p>
        </div>
      </div>

      <div className="dashboard-grid two-wide">
        <article className="card">
          <div className="card-header"><div><h3>{editingId ? 'Update stock' : 'Add stock line'}</h3><p>Store ID: {storeId || '-'}</p></div></div>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              Product
              <select className="select-input" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required>
                <option value="">Select product</option>
                {products.map((product) => <option key={product.product_id} value={product.product_id}>{product.product_name}</option>)}
              </select>
            </label>
            <label>
              Quantity
              <input className="text-input" type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            </label>
            <label>
              Reorder level
              <input className="text-input" type="number" min="0" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="row-actions">
              <button className="primary-button">{editingId ? 'Update' : 'Create'} inventory</button>
              <button type="button" className="ghost-button" onClick={resetForm}>Clear</button>
            </div>
          </form>
        </article>

        <article className="card">
          <div className="card-header"><div><h3>Stock lines</h3><p>{rows.length} rows</p></div></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Reorder</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4">Loading...</td></tr>
                ) : rows.length ? rows.map((row) => (
                  <tr key={row.inventory_id}>
                    <td>
                      <strong>{row.product?.product_name}</strong>
                      <div className="muted">{row.product?.sku}</div>
                    </td>
                    <td>{row.quantity}</td>
                    <td>{row.reorder_level || 0}</td>
                    <td>
                      <div className="row-actions compact">
                        <button className="ghost-button" onClick={() => handleEdit(row)}>Edit</button>
                        <button className="ghost-button danger" onClick={() => handleDelete(row.inventory_id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="4">No inventory rows found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
