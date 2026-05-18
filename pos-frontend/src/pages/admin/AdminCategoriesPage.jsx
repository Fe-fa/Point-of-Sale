import { useEffect, useState } from 'react';
import { categoryService } from '../../services/categoryService';

const initialForm = { category_name: '' };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const loadCategories = async () => {
    setLoading(true);
    try {
      const response = await categoryService.list({ search, per_page: 100 });
      setCategories(response.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, [search]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await categoryService.update(editingId, form);
      } else {
        await categoryService.create(form);
      }
      resetForm();
      loadCategories();
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.errors?.category_name?.[0] || 'Unable to save category.');
    }
  };

  const handleEdit = (category) => {
    setEditingId(category.category_id);
    setForm({ category_name: category.category_name });
  };

  const handleDelete = async (categoryId) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await categoryService.remove(categoryId);
      loadCategories();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to delete category.');
    }
  };

  return (
    <section className="stack-lg">
      {/* <div className="section-header">
        <input className="text-input search-small" placeholder="Search category" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div> */}
      <div className="dashboard-grid two-wide">
        <article className="card">
          <div className="card-header"><div><h3>{editingId ? 'Edit category' : 'New category'}</h3></div></div>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              Category name
              <input className="text-input" value={form.category_name} onChange={(e) => setForm({ category_name: e.target.value })} required />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="row-actions">
              <button className="primary-button">{editingId ? 'Update' : 'Create'} category</button>
              <button type="button" className="ghost-button" onClick={resetForm}>Clear</button>
            </div>
          </form>
        </article>

        <article className="card">
          <div className="card-header"><div><h3>Categories</h3><p>{categories.length} records</p></div></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Products</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="3">Loading...</td></tr>
                ) : categories.length ? categories.map((category) => (
                  <tr key={category.category_id}>
                    <td>{category.category_name}</td>
                    <td>{category.products_count || 0}</td>
                    <td>
                      <div className="row-actions compact">
                        <button className="ghost-button" onClick={() => handleEdit(category)}>Edit</button>
                        <button className="ghost-button danger" onClick={() => handleDelete(category.category_id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="3">No categories found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
