import api from '../lib/api';

export const supplierService = {
  async list(params = {}) {
    const response = await api.get('/suppliers', { params });
    return response.data;
  },

  async show(supplierId) {
    const response = await api.get(`/suppliers/${supplierId}`);
    return response.data;
  },

  async statement(supplierId) {
    const response = await api.get(`/suppliers/${supplierId}/statement`);
    return response.data;
  },

  async create(payload) {
    const response = await api.post('/suppliers', payload);
    return response.data;
  },

  async update(supplierId, payload) {
    const response = await api.put(`/suppliers/${supplierId}`, payload);
    return response.data;
  },

  async destroy(supplierId) {
    const response = await api.delete(`/suppliers/${supplierId}`);
    return response.data;
  },
};