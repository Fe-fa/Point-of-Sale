import {
  Bell,
  Boxes,
  Building2,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  ReceiptText,
  Settings,
  ShoppingBasket,
  Store,
  Sun,
  Users,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import { useTheme } from '../../contexts/ThemeContext';

const adminNavItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/stores', label: 'Stores', icon: Store },
  { to: '/admin/users', label: 'Users & Access', icon: Users },
  { to: '/admin/categories', label: 'Categories', icon: Boxes },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/inventory', label: 'Inventory', icon: ShoppingBasket },
  { to: '/admin/billings', label: 'Billings', icon: ReceiptText },
  { to: '/admin/orders', label: 'Orders', icon: ReceiptText },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

const managerNavItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Cashiers', icon: Users },
  { to: '/admin/categories', label: 'Categories', icon: Boxes },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/inventory', label: 'Inventory', icon: ShoppingBasket },
  { to: '/admin/billings', label: 'Billings', icon: ReceiptText },
  { to: '/admin/orders', label: 'Orders', icon: ReceiptText },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { stores, storeId, setStoreId, activeStore } = useStore();
  const { theme, toggleTheme } = useTheme();

  const navItems = user?.role === 'admin' ? adminNavItems : managerNavItems;
  const workspaceLabel = user?.role === 'admin' ? 'System admin workspace' : 'Store manager workspace';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar sidebar-spacious">
        <div className="brand-block">
          <div className="brand-logo">SP</div>
          <div>
            <h1>SwiftPOS</h1>
            <p>{workspaceLabel}</p>
          </div>
        </div>

        <div className="sidebar-summary cardless-panel">
          <div className="sidebar-kicker">Signed in as</div>
          <strong>{user?.full_name}</strong>
          <span>{user?.role === 'admin' ? 'Global access across all stores' : 'Access limited to assigned stores only'}</span>
        </div>

        <nav className="nav-list">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <section className="main-shell">
        <header className="topbar topbar-spacious">
          <div>
            <h2>Welcome back, {user?.first_name}</h2>
            <p>
              {user?.role === 'admin'
                ? 'Create stores, manage managers, and monitor performance across the platform.'
                : 'Manage the selected store, assign cashiers, and monitor daily activity.'}
            </p>
          </div>

          <div className="topbar-actions">
            <div className="store-switcher-panel">
              <span>Active store</span>
              <select className="select-input slim" value={storeId} onChange={(e) => setStoreId(e.target.value)} disabled={!stores.length}>
                {!stores.length ? <option value="">No store</option> : null}
                {stores.map((store) => (
                  <option key={store.store_id} value={store.store_id}>{store.store_name}</option>
                ))}
              </select>
            </div>
            <button className="icon-button" onClick={toggleTheme} title="Toggle theme">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="icon-button" title="Notifications">
              <Bell size={18} />
            </button>
            <button className="ghost-button" onClick={handleLogout}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </header>

        <main className="page-content">
          <section className="workspace-banner">
            <div className="workspace-banner-text">
              <span className="eyebrow">Current scope</span>
              <h3>{activeStore?.store_name || (user?.role === 'admin' ? 'All stores ready' : 'Assigned stores only')}</h3>
              <p>{user?.role === 'admin' ? 'Switch between stores and manage platform-wide data.' : 'Every admin page is limited to the selected assigned store.'}</p>
            </div>
            <div className="workspace-banner-icon"><Building2 size={26} /></div>
          </section>
          <Outlet />
        </main>
      </section>
    </div>
  );
}
