import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useStore } from './StoreContext';
import { cashierShiftService } from '../services/cashierShiftService';

const CashierShiftContext = createContext(null);

export function CashierShiftProvider({ children }) {
  const { user } = useAuth();
  const { storeId } = useStore();

  const [cashShiftPayload, setCashShiftPayload] = useState(null);
  const [cashShiftLoading, setCashShiftLoading] = useState(false);
  const [showCashOpeningModal, setShowCashOpeningModal] = useState(false);
  const [shiftError, setShiftError] = useState('');
  const [shiftSuccess, setShiftSuccess] = useState('');

  const [showDailySalesModal, setShowDailySalesModal] = useState(false);
  const [dailySalesReport, setDailySalesReport] = useState(null);
  const [dailySalesLoading, setDailySalesLoading] = useState(false);

  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [closeShiftLoading, setCloseShiftLoading] = useState(false);
  const [closeShiftError, setCloseShiftError] = useState('');
  const [closeShiftReport, setCloseShiftReport] = useState(null);
  const [closeShiftReportLoading, setCloseShiftReportLoading] = useState(false);

  const activeCashShift = cashShiftPayload?.shift || null;
  const cashShiftSummary = cashShiftPayload?.summary || {};
  const hasOpenCashShift = activeCashShift?.status === 'open';
  const isShiftClosed = activeCashShift?.status === 'closed';

  const loadCashShift = useCallback(async ({ silent = false } = {}) => {
    if (!storeId || !user?.user_id) {
      setCashShiftPayload(null);
      return null;
    }

    if (!silent) setCashShiftLoading(true);

    try {
      const response = await cashierShiftService.today(Number(storeId));
      const payload = response?.data || response || null;
      setCashShiftPayload(payload);
      return payload;
    } catch (err) {
      setCashShiftPayload(null);
      if (!silent) {
        setShiftError(err?.response?.data?.message || err?.message || 'Unable to load cashier shift.');
      }
      return null;
    } finally {
      if (!silent) setCashShiftLoading(false);
    }
  }, [storeId, user?.user_id]);

  useEffect(() => {
    void loadCashShift();
  }, [loadCashShift]);

  const handleOpenCashShift = useCallback(async ({ openingBalance, openingNote }) => {
    setCashShiftLoading(true);
    setShiftError('');

    try {
      const response = await cashierShiftService.open({
        store_id: Number(storeId),
        opening_balance: openingBalance,
        opening_note: openingNote || null,
      });
      const payload = response?.data || response || null;
      setCashShiftPayload(payload);
      setShowCashOpeningModal(false);
      setShiftSuccess('Cash shift opened successfully.');
    } catch (err) {
      throw new Error(err?.response?.data?.message || err?.message || 'Unable to open cash shift.');
    } finally {
      setCashShiftLoading(false);
    }
  }, [storeId]);

  const ensureCashShiftOpen = useCallback(() => {
    if (hasOpenCashShift) return true;
    setShowCashOpeningModal(true);
    setShiftError('Open your cash shift and record the opening balance before processing sales.');
    return false;
  }, [hasOpenCashShift]);

  const handleLoadDailySales = useCallback(async () => {
    if (!storeId || !user?.user_id) return;

    setDailySalesLoading(true);
    setShowDailySalesModal(true);
    setDailySalesReport(null);

    try {
      const response = await cashierShiftService.dailySales(Number(storeId), {
        cashier_user_id: user.user_id,
      });
      const report = response?.data || response || null;
      setDailySalesReport(report);
    } catch (err) {
      setShiftError(err?.response?.data?.message || err?.message || 'Unable to load daily sales.');
      setShowDailySalesModal(false);
    } finally {
      setDailySalesLoading(false);
    }
  }, [storeId, user?.user_id]);

  const handleOpenCloseShift = useCallback(async () => {
    if (!storeId || !user?.user_id) return;

    setCloseShiftError('');
    setShowCloseShiftModal(true);
    setCloseShiftReportLoading(true);
    setCloseShiftReport(null);

    try {
      const response = await cashierShiftService.dailySales(Number(storeId), {
        cashier_user_id: user.user_id,
      });
      const report = response?.data || response || null;
      setCloseShiftReport(report);
    } catch (err) {
      setCloseShiftError(err?.response?.data?.message || err?.message || 'Unable to load shift data.');
    } finally {
      setCloseShiftReportLoading(false);
    }
  }, [storeId, user?.user_id]);

  const handleCloseShiftConfirm = useCallback(async ({ countedCash, variance, closeNote }) => {
    if (!storeId) return;

    setCloseShiftLoading(true);
    setCloseShiftError('');

    try {
      await cashierShiftService.close({
        store_id: Number(storeId),
        counted_cash: countedCash,
        close_note: closeNote,
      });

      setShowCloseShiftModal(false);
      setShiftSuccess('Cashier shift closed successfully. Variance has been saved and will be carried forward to the next shift.');

      await loadCashShift();
    } catch (err) {
      setCloseShiftError(err?.response?.data?.message || err?.message || 'Unable to close shift.');
    } finally {
      setCloseShiftLoading(false);
    }
  }, [storeId, loadCashShift]);

const value = useMemo(() => ({
    cashShiftPayload,
    cashShiftLoading,
    activeCashShift,
    cashShiftSummary,
    hasOpenCashShift,
    isShiftClosed,
    showCashOpeningModal,
    setShowCashOpeningModal,
    shiftError,
    setShiftError,
    shiftSuccess,
    setShiftSuccess,
    loadCashShift,
    handleOpenCashShift,
    ensureCashShiftOpen,
    showDailySalesModal,
    setShowDailySalesModal,
    dailySalesReport,
    dailySalesLoading,
    handleLoadDailySales,
    showCloseShiftModal,
    setShowCloseShiftModal,
    closeShiftLoading,
    closeShiftError,
    setCloseShiftError,
    closeShiftReport,
    closeShiftReportLoading,
    handleOpenCloseShift,
    handleCloseShiftConfirm,
  }), [
    cashShiftPayload,
    cashShiftLoading,
    activeCashShift,
    cashShiftSummary,
    hasOpenCashShift,
    isShiftClosed,
    showCashOpeningModal,
    shiftError,
    shiftSuccess,
    loadCashShift,
    handleOpenCashShift,
    ensureCashShiftOpen,
    showDailySalesModal,
    dailySalesReport,
    dailySalesLoading,
    handleLoadDailySales,
    showCloseShiftModal,
    closeShiftLoading,
    closeShiftError,
    closeShiftReport,
    closeShiftReportLoading,
    handleOpenCloseShift,
    handleCloseShiftConfirm,
  ]);

  return (
    <CashierShiftContext.Provider value={value}>
      {children}
    </CashierShiftContext.Provider>
  );
}

export function useCashierShift() {
  const ctx = useContext(CashierShiftContext);
  if (!ctx) throw new Error('useCashierShift must be used within a CashierShiftProvider');
  return ctx;
}