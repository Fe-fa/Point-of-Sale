import { ShieldCheck, Save, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { accessControlService } from '../../services/accessControlService';

const editableRoles = ['manager', 'cashier'];

export default function AdminAccessControlPage() {
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingRole, setSavingRole] = useState('');
  const [savingUser, setSavingUser] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await accessControlService.index();
      setPermissions(response.data?.permissions || []);
      setRoles(response.data?.roles || []);
      setUsers(response.data?.users || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load access control data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const roleMap = useMemo(() => {
    return roles.reduce((acc, role) => {
      acc[role.name] = new Set(role.permissions || []);
      return acc;
    }, {});
  }, [roles]);

  const toggleRolePermission = (roleName, permissionName) => {
    setRoles((prev) =>
      prev.map((role) => {
        if (role.name !== roleName) return role;

        const current = new Set(role.permissions || []);
        if (current.has(permissionName)) current.delete(permissionName);
        else current.add(permissionName);

        return { ...role, permissions: Array.from(current) };
      })
    );
  };

  const saveRolePermissions = async (roleName) => {
    const role = roles.find((item) => item.name === roleName);
    if (!role) return;

    setSavingRole(roleName);
    setError('');
    setSuccess('');

    try {
      await accessControlService.updateRolePermissions(roleName, {
        permissions: role.permissions || [],
      });
      setSuccess(`${roleName} permissions updated successfully.`);
    } catch (err) {
      setError(err?.response?.data?.message || `Unable to update ${roleName} permissions.`);
    } finally {
      setSavingRole('');
    }
  };

  const handleUserRoleChange = async (userId, roleName) => {
    setSavingUser(String(userId));
    setError('');
    setSuccess('');

    try {
      await accessControlService.assignUserRole(userId, { role: roleName });

      setUsers((prev) =>
        prev.map((user) =>
          user.user_id === userId ? { ...user, role: roleName } : user
        )
      );

      setSuccess('User role updated successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to assign role.');
    } finally {
      setSavingUser('');
    }
  };

  return (
    <section className="stack-lg">
      <div className="catalog-hero">
        <div className="catalog-hero-copy">
          <h2 className="catalog-title">Roles & Permissions</h2>
          <p className="catalog-subtitle">
            Manage manager/cashier permissions and assign roles to users.
          </p>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}

      <div className="access-control-grid">
        <article className="card">
          <div className="card-header">
            <div>
              <h3>
                <ShieldCheck size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Role templates
              </h3>
              <p>Edit permissions for manager and cashier.</p>
            </div>
          </div>

          {loading ? (
            <p className="muted">Loading roles...</p>
          ) : (
            <div className="stack-lg">
              {editableRoles.map((roleName) => {
                const role = roles.find((item) => item.name === roleName);

                return (
                  <div key={roleName} className="access-role-card">
                    <div className="card-header">
                      <div>
                        <h3 style={{ textTransform: 'capitalize' }}>{roleName}</h3>
                        <p>{(role?.permissions || []).length} permissions selected</p>
                      </div>

                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => saveRolePermissions(roleName)}
                        disabled={savingRole === roleName}
                      >
                        <Save size={16} />
                        {savingRole === roleName ? 'Saving...' : 'Save'}
                      </button>
                    </div>

                    <div className="selection-grid">
                      {permissions.map((permission) => {
                        const checked = roleMap[roleName]?.has(permission.name) || false;

                        return (
                          <label key={`${roleName}-${permission.name}`} className="selection-card">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRolePermission(roleName, permission.name)}
                            />
                            <div className="permission-meta">
                              <strong>{permission.name}</strong>
                              <span>{permission.label || 'Permission access'}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="card">
          <div className="card-header">
            <div>
              <h3>
                <Users size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                User role assignment
              </h3>
              <p>Assign admin, manager, or cashier role to users.</p>
            </div>
          </div>

          {loading ? (
            <p className="muted">Loading users...</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Stores</th>
                    <th>Current role</th>
                    <th>Assign role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length ? (
                    users.map((user) => (
                      <tr key={user.user_id}>
                        <td>
                          <div className="catalog-item-copy">
                            <strong>{user.full_name || user.name || 'Unnamed user'}</strong>
                            <span>ID #{user.user_id}</span>
                          </div>
                        </td>
                        <td>{user.email || '-'}</td>
                        <td>
                          {user.stores?.length
                            ? user.stores.map((store) => store.store_name).join(', ')
                            : 'No assigned stores'}
                        </td>
                        <td>
                          <span className={`status-badge ${user.role === 'admin' ? 'paid' : 'draft'}`}>
                            {user.role || 'No role'}
                          </span>
                        </td>
                        <td>
                          <select
                            className="select-input slim"
                            value={user.role || ''}
                            onChange={(e) => handleUserRoleChange(user.user_id, e.target.value)}
                            disabled={savingUser === String(user.user_id)}
                          >
                            <option value="admin">admin</option>
                            <option value="manager">manager</option>
                            <option value="cashier">cashier</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
