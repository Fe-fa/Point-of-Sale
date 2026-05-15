import api from '../lib/api';

export const billingService = {
  list(params = {}) {
    return api.get('/billings', { params }).then((res) => res.data);
  },
  createDraft(payload) {
    return api.post('/billings', payload).then((res) => res.data);
  },
  show(billingId) {
    return api.get(`/billings/${billingId}`).then((res) => res.data);
  },
  update(billingId, payload) {
    return api.put(`/billings/${billingId}`, payload).then((res) => res.data);
  },
  remove(billingId) {
    return api.delete(`/billings/${billingId}`).then((res) => res.data);
  },
  items(billingId) {
    return api.get(`/billings/${billingId}/items`).then((res) => res.data);
  },
  addItem(billingId, payload) {
    return api.post(`/billings/${billingId}/items`, payload).then((res) => res.data);
  },
  updateItem(billingItemId, payload) {
    return api.put(`/billing-items/${billingItemId}`, payload).then((res) => res.data);
  },
  removeItem(billingItemId) {
    return api.delete(`/billing-items/${billingItemId}`).then((res) => res.data);
  },
  charge(billingId, payload) {
    return api.post(`/billings/${billingId}/charge`, payload).then((res) => res.data);
  },
};
