import api from '../lib/api';

export const cashierShiftService = {
  /**
   * GET /cashier-shifts/today
   * Returns the current cashier's shift status (opening balance + status only).
   */
  async today(storeId, params = {}) {
    const response = await api.get('/cashier-shifts/today', {
      params: {
        store_id: Number(storeId),
        ...params,
      },
    });
    return response.data;
  },

  /**
   * POST /cashier-shifts/open
   * Opens a new shift. Carry-forward variance is auto-applied server-side.
   */
  async open(payload) {
    const response = await api.post('/cashier-shifts/open', {
      ...payload,
      store_id: Number(payload.store_id),
      opening_balance: Number(payload.opening_balance || 0),
    });
    return response.data;
  },

  /**
   * POST /cashier-shifts/close
   * Closes a shift with drawer reconciliation.
   * Cashier can close own; manager/admin can close any (pass cashier_user_id).
   */
  async close(payload) {
    const response = await api.post('/cashier-shifts/close', {
      ...payload,
      store_id: Number(payload.store_id),
      cashier_user_id:
        payload.cashier_user_id === null || payload.cashier_user_id === undefined || payload.cashier_user_id === ''
          ? null
          : Number(payload.cashier_user_id),
      counted_cash:
        payload.counted_cash === null || payload.counted_cash === undefined || payload.counted_cash === ''
          ? null
          : Number(payload.counted_cash),
      close_note: payload.close_note || null,
    });
    return response.data;
  },

  async dailySales(storeId, params = {}) {
    const response = await api.get('/cashier-shifts/daily-sales', {
      params: {
        store_id: Number(storeId),
        ...params,
      },
    });
    return response.data;
  },

  async allCashiers(storeId, params = {}) {
    const response = await api.get('/cashier-shifts/all-cashiers', {
      params: {
        store_id: Number(storeId),
        ...params,
      },
    });
    return response.data;
  },

  /**
   * GET /cashier-shifts/report (legacy)
   */
  async report(params = {}) {
    const response = await api.get('/cashier-shifts/report', { params });
    return response.data;
  },
};

export default cashierShiftService;
