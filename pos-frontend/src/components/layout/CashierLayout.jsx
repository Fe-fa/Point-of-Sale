import { Bell, LogOut, Moon, Sun, UserCircle2 } from 'lucide-react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function CashierLayout() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { activeStore } = useStore();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const activeStoreName = activeStore?.store_name || 'Assigned store';

  return (
    <div className="cashier-shell">
      <header className="cashier-topbar">
        <div className="brand-inline">
          <div className="brand-logo">SP</div>
          <div>
            <h1>SwiftPOS</h1>
            <p>{activeStoreName}</p>
          </div>
        </div>

        <div className="cashier-tools">
          <span className="store-name">{activeStoreName}</span>

          <button type="button" className="icon-button" onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <button type="button" className="icon-button">
            <Bell size={18} />
          </button>

          <div className="cashier-user">
            <UserCircle2 size={28} />
            <span>{user?.full_name}</span>
          </div>

          <button type="button" className="ghost-button" onClick={handleLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}
