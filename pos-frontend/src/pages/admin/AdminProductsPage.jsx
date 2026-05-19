import { X, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { categoryService } from '../../services/categoryService';
import { productService } from '../../services/productService';
import { currency } from '../../utils/helpers';
import { useStore } from '../../contexts/StoreContext';

const initialForm = {
  category_id: '',
  sku: '',
  product_name: '',
  image_url: '',
  price: '',
  cost_price: '',
  vat_rate: 0,
  apply_vat: false,
  is_active: true,
};

const extractList = (res) => {
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
};

export default function AdminProductsPage() {
  const { stores, storeId } = useStore();
  const currentStore = stores.find((store) => String(store.store_id) === String(storeId));

  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        productService.list({ search, per_page: 100 }),
        categoryService.list({ per_page: 100 }),
      ]);
      setProducts(extractList(productsRes));
      setCategories(extractList(categoriesRes));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to load products.');
      setProducts([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search]);

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
        ...form,
        category_id: Number(form.category_id),
        price: Number(form.price),
        cost_price: Number(form.cost_price),
        vat_rate: form.apply_vat ? Number(form.vat_rate || 0) : 0,
        image_url: form.image_url?.trim() || null,
        is_active: !!form.is_active,
      };
      delete payload.apply_vat;

      if (editingId) await productService.update(editingId, payload);
      else await productService.create(payload);

      setShowModal(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to save product.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (product) => {
    setEditingId(product.product_id);
    setForm({
      category_id: product.category_id || '',
      sku: product.sku || '',
      product_name: product.product_name || '',
      image_url: product.image_url || '',
      price: product.price || '',
      cost_price: product.cost_price || '',
      vat_rate: product.vat_rate || '',
      apply_vat: Number(product.vat_rate || 0) > 0,
      is_active: Boolean(product.is_active),
    });
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await productService.remove(productId);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to delete product.');
    }
  };

  return (
    <>
<section className="stack-lg">
<div className="catalog-hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
  <div className="catalog-hero-copy" style={{ display: 'flex', flexDirection: 'column' }}>
    <h2 className="catalog-title">Products</h2>
    <p className="catalog-subtitle">{products.length} products in catalog</p>
  </div>
  {/* catalog-primary-btn is a new class added for better styling of the primary action button */}
<button   type="button"   className="ghost-button"   onClick={openCreateModal}>
  <Plus size={18} />
  New product
</button>
</div>
        <div className="catalog-toolbar">
          <label className="catalog-search">
            <input
              className="text-input"
              placeholder="Search product"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        {error && !showModal ? <p className="form-error">{error}</p> : null}

        <article className="catalog-table-card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Pricing</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6">Loading...</td></tr>
                ) : products.length ? (
                  products.map((product) => (
                    <tr key={product.product_id}>
                      <td>
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.product_name}
                            style={{
                              width: 56,
                              height: 56,
                              objectFit: 'cover',
                              borderRadius: 12,
                              border: '1px solid var(--line)',
                              background: 'var(--panel-2)',
                            }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="muted">No image</div>
                        )}
                      </td>
                      <td>
                        <strong>{product.product_name}</strong>
                        <div className="muted">{product.sku}</div>
                      </td>
                      <td>{product.category?.category_name || '-'}</td>
                      <td>
                        <div>{currency(product.price, currentStore?.currency)}</div>
                        <div className="muted">Cost {currency(product.cost_price, currentStore?.currency)}</div>
                        <div className="muted">
                          {Number(product.vat_rate || 0) > 0 ? `VAT ${Number(product.vat_rate || 0)}%` : 'No VAT'}
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${product.is_active ? 'paid' : 'draft'}`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions compact">
                          <button type="button" className="ghost-button" onClick={() => handleEdit(product)}>Edit</button>
                          <button type="button" className="ghost-button danger" onClick={() => handleDelete(product.product_id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="6">No products found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {showModal ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card form-modal-card form-modal-card-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{editingId ? 'Edit product' : 'New product'}</h3>
                <p className="muted">Add product details including image URL.</p>
              </div>
              <button type="button" className="icon-button" onClick={closeModal} disabled={submitting}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-content">
              <form className="catalog-form-grid" onSubmit={handleSubmit}>
                <label>
                  Category
                  <select
                    className="select-input"
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.category_id} value={category.category_id}>
                        {category.category_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  SKU
                  <input className="text-input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
                </label>

                <label>
                  Product name
                  <input className="text-input" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} required />
                </label>

                <label>
                  Selling price
                  <input className="text-input" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                </label>

                <label>
                  Cost price
                  <input className="text-input" type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} required />
                </label>

                <label>
                  VAT rate (%)
                  <input
                    className="text-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.vat_rate}
                    disabled={!form.apply_vat}
                    onChange={(e) => setForm({ ...form, vat_rate: e.target.value })}
                    placeholder={form.apply_vat ? 'Enter VAT rate' : 'Enable VAT first'}
                  />
                </label>

                <label className="span-2">
                  Product image URL
                  <input
                    className="text-input"
                    type="url"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </label>

                {form.image_url ? (
                  <div className="catalog-preview span-2">
                    <div className="catalog-preview-image-wrap">
                      <img
                        src={form.image_url}
                        alt="Preview"
                        className="catalog-preview-image"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                    <div className="catalog-preview-copy">
                      <strong>Image preview</strong>
                      <p>If the image does not load, check the URL and make sure it is publicly accessible.</p>
                    </div>
                  </div>
                ) : null}

                <label className="checkbox-row span-2 catalog-check">
                  <input
                    type="checkbox"
                    checked={form.apply_vat}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        apply_vat: e.target.checked,
                        vat_rate: e.target.checked ? form.vat_rate || 0 : '',
                      })
                    }
                  />
                  <span>Apply VAT for this product</span>
                </label>

                <label className="checkbox-row span-2 catalog-check">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  <span>Product is active in cashier</span>
                </label>

                {error ? <p className="form-error span-2">{error}</p> : null}

                <div className="catalog-modal-actions span-2">
                  <button type="button" className="ghost-button" onClick={closeModal} disabled={submitting}>
                    Cancel
                  </button>
                  <button className="catalog-primary-btn" type="submit" disabled={submitting}>
                    {editingId ? 'Update product' : 'Create product'}
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
