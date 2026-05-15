import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import { userService } from '../../services/userService';
import { extractList } from '../../utils/helpers';

const initialForm = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  phone: '',
  password: '',
  password_confirmation: '',
  role: 'cashier',
  is_active: true,
  store_ids: [],
};

function normalizeUser(user) {
  return {
    ...user,
    stores: Array.isArray(user?.stores) ? user.stores : [],
  };
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const { stores, activeStore } = useStore();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [roleFilter, setRoleFilter] = useState(user?.role === 'admin' ? 'all' : 'cashier');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [openForm, setOpenForm] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [assigningUser, setAssigningUser] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [assignStoreIds, setAssignStoreIds] = useState([]);
  const isAdmin = user?.role === 'admin';
  const selectableStores = useMemo(() => {
    if (isAdmin) return stores;
    return activeStore ? [activeStore] : stores;
  }, [activeStore, isAdmin, stores]);

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const params = { per_page: 200 };
      if (roleFilter !== 'all') params.role = roleFilter;
      if (assignmentFilter !== 'all') params.assigned = assignmentFilter;
      if (!isAdmin && activeStore?.store_id) params.store_id = activeStore.store_id;
      const response = await userService.list(params);
      setRows(extractList(response).map(normalizeUser));
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load users.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [roleFilter, assignmentFilter, activeStore?.store_id]);

  const openCreateModal = () => {
    setEditingUser(null);
    setForm({
      ...initialForm,
      role: isAdmin ? 'manager' : 'cashier',
      store_ids: !isAdmin && activeStore ? [String(activeStore.store_id)] : [],
    });
    setOpenForm(true);
    setMessage('');
    setError('');
  };

  const openEditModal = (row) => {
    setEditingUser(row);
    setForm({
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      username: row.username || '',
      email: row.email || '',
      phone: row.phone || '',
      password: '',
      password_confirmation: '',
      role: row.role || 'cashier',
      is_active: !!row.is_active,
      store_ids: (row.stores || []).map((store) => String(store.store_id)),
    });
    setOpenForm(true);
    setMessage('');
    setError('');
  };

  const openAssignModal = (row) => {
    setAssigningUser(row);
    setAssignStoreIds((row.stores || []).map((store) => String(store.store_id)));
    setOpenAssign(true);
    setMessage('');
    setError('');
  };

  const handleStoreToggle = (storeId) => {
    setForm((current) => ({
      ...current,
      store_ids: current.store_ids.includes(storeId)
        ? current.store_ids.filter((value) => value !== storeId)
        : [...current.store_ids, storeId],
    }));
  };

  const handleAssignStoreToggle = (storeId) => {
    setAssignStoreIds((current) => (
      current.includes(storeId)
        ? current.filter((value) => value !== storeId)
        : [...current, storeId]
    ));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const payload = {
        ...form,
        store_ids: form.role === 'admin' ? [] : form.store_ids.map(Number),
        default_store_id: form.role === 'admin' ? null : Number(form.store_ids[0] || '') || null,
      };

      if (editingUser && !payload.password) {
        delete payload.password;
        delete payload.password_confirmation;
      }

      if (!isAdmin) {
        payload.role = 'cashier';
        payload.store_ids = activeStore ? [Number(activeStore.store_id)] : [];
        payload.default_store_id = activeStore ? Number(activeStore.store_id) : null;
      }

      let response;
      if (editingUser) {
        response = await userService.update(editingUser.user_id, payload);
      } else {
        response = await userService.create(payload);
      }

      const targetUserId = response?.user?.user_id || response?.data?.user_id || editingUser?.user_id;
      if (targetUserId && payload.role !== 'admin') {
        await userService.syncStores(targetUserId, payload.store_ids || []);
      }

      setOpenForm(false);
      setMessage(editingUser ? 'User updated successfully.' : 'User created successfully.');
      setForm(initialForm);
      setEditingUser(null);
      load();
    } catch (err) {
      const errors = err?.response?.data?.errors;
      const firstError = errors ? Object.values(errors)[0]?.[0] : null;
      setError(firstError || err?.response?.data?.message || 'Unable to save user.');
    }
  };

  const handleAssignSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await userService.syncStores(assigningUser.user_id, assignStoreIds.map(Number));
      setOpenAssign(false);
      setMessage('Store assignment updated successfully.');
      setAssigningUser(null);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to update store assignment.');
    }
  };

  const handleDeactivate = async (row) => {
    if (!window.confirm(`Deactivate ${row.full_name || row.username}?`)) return;

    try {
      await userService.remove(row.user_id);
      setMessage('User updated successfully.');
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to update user.');
    }
  };

  return (
    <section className="stack-lg">
      <div className="section-header split-header">
        <div>
          <h2>{isAdmin ? 'Users & access' : 'Cashier assignments'}</h2>
          <p>
            {isAdmin
              ? 'Create managers, register cashiers, and assign each person to the right stores.'
              : 'Manage cashiers inside your assigned store and approve pending access.'}
          </p>
        </div>

        <div className="row-actions">
          <select className="select-input slim" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All roles</option>
            {isAdmin ? <option value="manager">Managers</option> : null}
            <option value="cashier">Cashiers</option>
          </select>
          <select className="select-input slim" value={assignmentFilter} onChange={(e) => setAssignmentFilter(e.target.value)}>
            <option value="all">All assignments</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <button className="primary-button" onClick={openCreateModal}>
            {isAdmin ? 'New user' : 'New cashier'}
          </button>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}

      <article className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Stores</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5">Loading...</td></tr>
              ) : rows.length ? rows.map((row) => (
                <tr key={row.user_id}>
                  <td>
                    <strong>{row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.username}</strong>
                    <div className="muted">{row.email || row.username}</div>
                  </td>
                  <td><span className="badge">{row.role}</span></td>
                  <td>
                    {(row.stores || []).length
                      ? row.stores.map((store) => store.store_name).join(', ')
                      : 'Pending assignment'}
                  </td>
                  <td><span className={`badge ${row.is_active ? 'success' : 'danger'}`}>{row.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="row-actions compact">
                      <button className="ghost-button" onClick={() => openEditModal(row)}>Edit</button>
                      {row.role !== 'admin' ? <button className="ghost-button" onClick={() => openAssignModal(row)}>Assign stores</button> : null}
                      {row.role !== 'admin' ? <button className="ghost-button danger" onClick={() => handleDeactivate(row)}>Deactivate</button> : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="5">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <Modal open={openForm} title={editingUser ? 'Edit user' : isAdmin ? 'Create user' : 'Create cashier'} onClose={() => setOpenForm(false)} width="820px">
        <form className="form-grid two-columns" onSubmit={handleSubmit}>
          <label>
            First name
            <input className="text-input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
          </label>
          <label>
            Last name
            <input className="text-input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
          </label>
          <label>
            Username
            <input className="text-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          </label>
          <label>
            Email
            <input className="text-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label>
            Phone
            <input className="text-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>
            Role
            <select className="select-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, store_ids: e.target.value === 'admin' ? [] : form.store_ids })} disabled={!isAdmin}>
              {isAdmin ? <option value="manager">Manager</option> : null}
              <option value="cashier">Cashier</option>
              {isAdmin ? <option value="admin">Admin</option> : null}
            </select>
          </label>
          <label>
            Password
            <input className="text-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editingUser ? 'Leave blank to keep current password' : ''} required={!editingUser} />
          </label>
          <label>
            Confirm password
            <input className="text-input" type="password" value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} required={!editingUser || !!form.password} />
          </label>

          {form.role !== 'admin' ? (
            <div className="span-2 stack-md">
              <strong>Store assignment</strong>
              <div className="selection-grid">
                {selectableStores.map((store) => {
                  const storeId = String(store.store_id);
                  const checked = form.store_ids.includes(storeId);
                  return (
                    <label key={storeId} className="selection-card">
                      <input type="checkbox" checked={checked} onChange={() => handleStoreToggle(storeId)} />
                      <div>
                        <strong>{store.store_name}</strong>
                        <span>{store.location || store.currency}</span>
                      </div>
                    </label>
                  );
                })}
                {!selectableStores.length ? <p className="muted">No stores available for assignment yet.</p> : null}
              </div>
            </div>
          ) : null}

          <label className="checkbox-row span-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            <span>User is active</span>
          </label>

          {error ? <p className="form-error span-2">{error}</p> : null}

          <div className="row-actions span-2">
            <button className="primary-button">{editingUser ? 'Save changes' : 'Create user'}</button>
            <button type="button" className="ghost-button" onClick={() => setOpenForm(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal open={openAssign} title={`Assign stores${assigningUser ? ` - ${assigningUser.full_name || assigningUser.username}` : ''}`} onClose={() => setOpenAssign(false)} width="720px">
        <form className="stack-md" onSubmit={handleAssignSubmit}>
          <div className="selection-grid">
            {selectableStores.map((store) => {
              const storeId = String(store.store_id);
              const checked = assignStoreIds.includes(storeId);
              return (
                <label key={storeId} className="selection-card">
                  <input type="checkbox" checked={checked} onChange={() => handleAssignStoreToggle(storeId)} />
                  <div>
                    <strong>{store.store_name}</strong>
                    <span>{store.location || store.currency}</span>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="row-actions">
            <button className="primary-button">Save assignment</button>
            <button type="button" className="ghost-button" onClick={() => setOpenAssign(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
