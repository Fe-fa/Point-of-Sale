import api from '../lib/api';

export const storeService = {
  list(params = {}) {
    return api.get('/stores', { params }).then((res) => res.data);
  },

  show(storeId) {
    return api.get(`/stores/${storeId}`).then((res) => res.data);
  },

  create(payload) {
    return api.post('/stores', payload).then((res) => res.data);
  },

  update(storeId, payload) {
    return api.put(`/stores/${storeId}`, payload).then((res) => res.data);
  },

  remove(storeId) {
    return api.delete(`/stores/${storeId}`).then((res) => res.data);
  },

  settings(storeId) {
    return api.get(`/stores/${storeId}/settings`).then((res) => res.data);
  },

  updateSettings(storeId, payload) {
    return api.put(`/stores/${storeId}/settings`, payload).then((res) => res.data);
  },
};
