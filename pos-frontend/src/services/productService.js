import api from '../lib/api';

export const productService = {
  list(params = {}) {
    return api.get('/products', { params }).then((res) => res.data);
  },
  create(payload) {
    return api.post('/products', payload).then((res) => res.data);
  },
  update(productId, payload) {
    return api.put(`/products/${productId}`, payload).then((res) => res.data);
  },
  remove(productId) {
    return api.delete(`/products/${productId}`).then((res) => res.data);
  },
};
