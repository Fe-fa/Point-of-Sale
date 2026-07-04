// src/services/paymentService.js
// (replaces the existing thin file — adds a `charge` helper used by the
//  M-Pesa flow after receipt validation.)

import api from '../lib/api';

export const paymentService = {
  async list(params = {}) {
    const response = await api.get('/payments', { params });
    return response.data;
  },

  async show(paymentId) {
    const response = await api.get(`/payments/${paymentId}`);
    return response.data;
  },

  /**
   * Direct billing charge (cash / card / already-validated mpesa).
   * @param {number} billingId
   * @param {object} payload  see ChargeBillingRequest rules
   */
  async chargeBilling(billingId, payload) {
    const response = await api.post(`/billings/${billingId}/charge`, payload);
    return response.data;
  },

  /**
   * Charge a fresh cart in one shot (chargeCart endpoint).
   */
  async chargeCart(payload) {
    const response = await api.post(`/billings/charge`, payload);
    return response.data;
  },
};
