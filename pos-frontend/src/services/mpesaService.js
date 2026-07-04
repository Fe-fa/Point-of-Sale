// src/services/mpesaService.js
import api from '../lib/api';

export const mpesaService = {
  /**
   * Push STK to customer's phone.
   * @param {{ billing_id?: number, grn_id?: number, phone: string, amount?: number }} payload
   */
  async initiateStkPush(payload) {
    const response = await api.post('/mpesa/stk-push', payload);
    return response.data; // { data: { checkout_request_id, status, polling: {...} } }
  },

  /**
   * Poll the status of an in-flight STK request.
   * @param {string} checkoutRequestId
   */
  async status(checkoutRequestId) {
    const response = await api.get(`/mpesa/status/${encodeURIComponent(checkoutRequestId)}`);
    return response.data;
  },

  /**
   * Cashier gave up — mark txn cancelled so a new attempt can be initiated.
   */
  async cancel(checkoutRequestId) {
    const response = await api.post(`/mpesa/cancel/${encodeURIComponent(checkoutRequestId)}`);
    return response.data;
  },

  /**
   * Manual M-Pesa code entry (offline / customer already paid).
   * @param {{ billing_id: number, mpesa_receipt: string, amount: number, phone?: string }} payload
   */
  async validateReceipt(payload) {
    const response = await api.post('/mpesa/validate-receipt', payload);
    return response.data;
  },
};
