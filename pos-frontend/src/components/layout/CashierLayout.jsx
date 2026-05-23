import { Bell, LogOut, Moon, Sun, UserCircle2 } from 'lucide-react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function CashierLayout() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  
  // FIX 1: Cleaned up useStore to extract what you need cleanly in one destructure block
  const { activeStore } = useStore(); 
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const activeStoreName = activeStore?.store_name || 'Assigned store';

  return (
    <div className="cashier-shell">
      <header className="cashier-topbar">
        <div className="brand-inline">
          <div className="brand-logo">
            {/* FIX 2: Switched 'store' to 'activeStore' so it correctly references your state */}
            {activeStore?.logo_url ? (
              <img 
                src={activeStore.logo_url} 
                alt={`${activeStoreName} Logo`} 
                className="store-logo-img"
                onError={(e) => {
                  // Fallback to text initials if image fails to load
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
            ) : null}
            
            {/* Fallback initials display if logo doesn't exist or fails */}
            {!activeStore?.logo_url && <span>SP</span>}
          </div>
          
          <div>
            <h1>SwiftPOS</h1>
            <p>{activeStoreName}</p>
          </div>
        </div>

        <div className="cashier-tools">
          {/* Dynamic Role Badging: Cashier, Admin, Manager */}
          <span className="eyebrow" style={{ marginRight: '10px', textTransform: 'capitalize' }}>
            {user?.role || 'Cashier'}
          </span>

          <button type="button" className="icon-button" onClick={toggleTheme} aria-label="Toggle Theme">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <button type="button" className="icon-button" aria-label="Notifications">
            <Bell size={18} />
          </button>

          <div className="cashier-user">
            <UserCircle2 size={25} />
            {user?.full_name || 'Employee'}
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