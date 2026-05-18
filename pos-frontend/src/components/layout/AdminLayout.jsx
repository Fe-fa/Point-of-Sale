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
  const workspaceLabel = user?.role === 'admin' ? 'System admin' : 'Store manager';

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
                ? 'System admin'
                : 'Store manager'}
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
          <Outlet />
        </main>
      </section>
    </div>
  );
}
