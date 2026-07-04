import api from '../lib/api';

export const grnService = {
  async list(params = {}) {
    const response = await api.get('/grns', { params });
    return response.data;
  },

  async show(grnId) {
    const response = await api.get(`/grns/${grnId}`);
    return response.data;
  },

  async createDraft(payload) {
    const response = await api.post('/grns', payload);
    return response.data;
  },

  async update(grnId, payload) {
    const response = await api.put(`/grns/${grnId}`, payload);
    return response.data;
  },

  async addItem(grnId, payload) {
    const response = await api.post(`/grns/${grnId}/items`, payload);
    return response.data;
  },

  async updateItem(grnId, itemId, payload) {
    const response = await api.put(`/grns/${grnId}/items/${itemId}`, payload);
    return response.data;
  },

  async removeItem(grnId, itemId) {
    const response = await api.delete(`/grns/${grnId}/items/${itemId}`);
    return response.data;
  },

  async charge(grnId, payload) {
    const response = await api.post(`/grns/${grnId}/charge`, payload);
    return response.data;
  },

  async complete(grnId, payload = {}) {
    const response = await api.post(`/grns/${grnId}/complete`, payload);
    return response.data;
  },

  async destroy(grnId) {
    const response = await api.delete(`/grns/${grnId}`);
    return response.data;
  },
};
