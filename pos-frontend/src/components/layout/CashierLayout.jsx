import { Bell, Lock, LogOut, Moon, Sun, UserCircle2, ShieldCheck, FileBarChart } from 'lucide-react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import { useTheme } from '../../contexts/ThemeContext';
import { CashierShiftProvider, useCashierShift } from '../../contexts/CashierShiftContext';
import CashOpeningModal from '../../components/modals/CashOpeningModal';
import CashierDailySalesModal from '../../components/modals/CashierDailySalesModal';
import CashierCloseShiftModal from '../../components/modals/CashierCloseShiftModal';

function CashierShiftInline() {
  const {
    hasOpenCashShift,
    cashShiftLoading,
    cashShiftSummary,
    closeShiftReportLoading,
    setShowCashOpeningModal,
    handleOpenCloseShift,
    handleLoadDailySales,
  } = useCashierShift();

  // Nothing open yet — keep it minimal: just the action to start a shift.
  if (!hasOpenCashShift) {
    return (
      <button
        type="button"
        className="primary-button"
        onClick={() => setShowCashOpeningModal(true)}
        disabled={cashShiftLoading}
        style={{ fontSize: 12, padding: '8px 14px' }}
      >
        {cashShiftLoading ? 'Checking shift…' : 'Open Shift'}
      </button>
    );
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      {/* <button
        type="button"
        className="ghost-button"
        onClick={handleLoadDailySales}
        disabled={cashShiftLoading}
        title="View your daily sales report"
        style={{ fontSize: 12 }}
      >
        <FileBarChart size={15} /> Daily Sales
      </button> */}

      <button
        type="button"
        className="ghost-button"
        onClick={handleOpenCloseShift}
        disabled={cashShiftLoading || closeShiftReportLoading}
        title="Close your cash shift and reconcile drawer"
        style={{ borderColor: 'rgba(207, 58, 58, 0.3)', color: '#cf3a3a', fontSize: 12 }}
      >
        <Lock size={15} /> Close Shift
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, marginLeft: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>Shift status</span>
        <strong style={{ fontSize: 13, textTransform: 'capitalize' }}>
          {cashShiftSummary?.status || 'open'}
        </strong>
      </div>
    </div>
  );
}

function CashierShiftModals() {
  const {
    showCashOpeningModal,
    setShowCashOpeningModal,
    cashShiftLoading,
    hasOpenCashShift,
    cashShiftSummary,
    handleOpenCashShift,
    showDailySalesModal,
    setShowDailySalesModal,
    dailySalesLoading,
    dailySalesReport,
    showCloseShiftModal,
    setShowCloseShiftModal,
    closeShiftLoading,
    closeShiftReportLoading,
    closeShiftError,
    setCloseShiftError,
    closeShiftReport,
    handleCloseShiftConfirm,
  } = useCashierShift();

  const { activeStore } = useStore();

  return (
    <>
      <CashOpeningModal
        isOpen={showCashOpeningModal}
        loading={cashShiftLoading}
        currentCurrency={activeStore?.currency || 'KES'}
        carryForwardVariance={cashShiftSummary?.carry_forward_variance || 0}
        onClose={() => {
          if (!hasOpenCashShift) return;
          setShowCashOpeningModal(false);
        }}
        onSubmit={handleOpenCashShift}
      />

      <CashierDailySalesModal
        isOpen={showDailySalesModal}
        loading={dailySalesLoading}
        report={dailySalesReport}
        currentCurrency={activeStore?.currency || 'KES'}
        onClose={() => setShowDailySalesModal(false)}
      />

      <CashierCloseShiftModal
        isOpen={showCloseShiftModal}
        loading={closeShiftLoading || closeShiftReportLoading}
        error={closeShiftError}
        shiftData={closeShiftReport}
        currentCurrency={activeStore?.currency || 'KES'}
        isManagerOverride={false}
        onClose={() => {
          if (closeShiftLoading) return;
          setShowCloseShiftModal(false);
          setCloseShiftError('');
        }}
        onConfirm={handleCloseShiftConfirm}
      />
    </>
  );
}

export default function CashierLayout() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { activeStore } = useStore();
  const { theme, toggleTheme } = useTheme();

  const isAdmin   = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canGoBack = isAdmin || isManager;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleBackToPanel = () => {
    if (isAdmin)   navigate('/admin/dashboard');
    if (isManager) navigate('/admin/manager');
  };

  const activeStoreName = activeStore?.store_name || 'Assigned store';

  return (
    <CashierShiftProvider>
      <div className="cashier-shell">
        <header className="cashier-topbar" >
          <div className="brand-inline">
            <div className="brand-logo">
              {activeStore?.logo_url ? (
                <img
                  src={activeStore.logo_url}
                  alt={`${activeStoreName} Logo`}
                  className="store-logo-img"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                  }}
                />
              ) : null}
              {!activeStore?.logo_url && <span>SP</span>}
            </div>

            <div className="cashier-tools">
              <div>
                <h1>SwiftPOS</h1>
                <p>{activeStoreName}</p>
              </div>
            </div>

            <button type="button" className="icon-button" onClick={toggleTheme}>
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <button type="button" className="icon-button">
              <Bell size={18} />
            </button>

            <div className="cashier-user" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <UserCircle2 size={25} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span>{user?.full_name || 'Employee'}</span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: canGoBack
                    ? 'var(--hero-teal-2)'
                    : 'var(--muted)',
                }}>
                  {user?.role || 'cashier'}
                </span>
              </div>
            </div>

            {/* Shift controls now sit inline, right after the cashier name/role */}
            <CashierShiftInline />

            {canGoBack && (
              <button
                type="button"
                className="ghost-button"
                onClick={handleBackToPanel}
                title={isAdmin ? 'Back to admin panel' : 'Back to manager panel'}
                style={{ fontSize: 12 }}
              >
                <ShieldCheck size={14} />
                {isAdmin ? 'Admin' : 'Manager'}
              </button>
            )}
          </div>

          <button type="button" className="ghost-button" onClick={handleLogout}>
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </header>

        <main className="page-content">
          <Outlet />
        </main>

        <CashierShiftModals />
      </div>
    </CashierShiftProvider>
  );
}