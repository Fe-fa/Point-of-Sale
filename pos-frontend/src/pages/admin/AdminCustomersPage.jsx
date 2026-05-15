import { useEffect, useState } from 'react';
import { customerService } from '../../services/customerService';
import { currency } from '../../utils/helpers';
import { useStore } from '../../contexts/StoreContext';

const initialForm = { full_name: '', email: '', phone: '', current_balance: 0 };

export default function AdminCustomersPage() {
  const { stores, storeId } = useStore();
  const currentStore = stores.find((store) => String(store.store_id) === String(storeId));
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const response = await customerService.list({ search, per_page: 100 });
      setCustomers(response.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCustomers(); }, [search]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await customerService.update(editingId, form);
      else await customerService.create(form);
      resetForm();
      loadCustomers();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to save customer.');
    }
  };

  const handleEdit = (customer) => {
    setEditingId(customer.customer_id);
    setForm({
      full_name: customer.full_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      current_balance: customer.current_balance || 0,
    });
  };

  const handleDelete = async (customerId) => {
    if (!window.confirm('Delete this customer?')) return;
    try {
      await customerService.remove(customerId);
      loadCustomers();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to delete customer.');
    }
  };

  return (
    <section className="stack-lg">
      <div className="section-header">
        <div>
          <h2>Customers</h2>
          <p>Manage saved customers for billings, balances, and quick cashier lookup.</p>
        </div>
        <input className="text-input search-small" placeholder="Search customer" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="dashboard-grid two-wide">
        <article className="card">
          <div className="card-header"><div><h3>{editingId ? 'Edit customer' : 'New customer'}</h3></div></div>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              Full name
              <input className="text-input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </label>
            <label>
              Email
              <input className="text-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label>
              Phone
              <input className="text-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label>
              Opening balance
              <input className="text-input" type="number" min="0" step="0.01" value={form.current_balance} onChange={(e) => setForm({ ...form, current_balance: e.target.value })} />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="row-actions">
              <button className="primary-button">{editingId ? 'Update' : 'Create'} customer</button>
              <button type="button" className="ghost-button" onClick={resetForm}>Clear</button>
            </div>
          </form>
        </article>

        <article className="card">
          <div className="card-header"><div><h3>Customer records</h3><p>{customers.length} customers</p></div></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contacts</th>
                  <th>Balance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4">Loading...</td></tr>
                ) : customers.length ? customers.map((customer) => (
                  <tr key={customer.customer_id}>
                    <td>{customer.full_name}</td>
                    <td>
                      <div>{customer.phone || '-'}</div>
                      <div className="muted">{customer.email || '-'}</div>
                    </td>
                    <td>{currency(customer.current_balance, currentStore?.currency)}</td>
                    <td>
                      <div className="row-actions compact">
                        <button className="ghost-button" onClick={() => handleEdit(customer)}>Edit</button>
                        <button className="ghost-button danger" onClick={() => handleDelete(customer.customer_id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="4">No customers found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
