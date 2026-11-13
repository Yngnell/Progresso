// Annual Budget and ABYIP Item. The balances come from the server.
import api from './axios';

export const budgetApi = {
  // { budgets: [{ id, year, totalBudget, fundSource, remarks, allotted, unallotted }], fundSources }
  listBudgets: () => api.get('/budgets').then((r) => r.data),
  createBudget: (data) => api.post('/budgets', data).then((r) => r.data),
  updateBudget: (id, data) => api.put(`/budgets/${id}`, data).then((r) => r.data),
  // { items: [{ ..., allottedAmount, reserved, used, remaining }], summary, centers, quarters }
  listItems: (params) => api.get('/abyip', { params }).then((r) => r.data),
  // One item and its remaining balance; excludeProject leaves that request out of the balance.
  getItem: (id, params) => api.get(`/abyip/${id}`, { params }).then((r) => r.data),
  createItem: (data) => api.post('/abyip', data).then((r) => r.data),
  updateItem: (id, data) => api.put(`/abyip/${id}`, data).then((r) => r.data),
};

// The server answers a refused form with { message, errors: { field: text } }.
export const fieldErrors = (err) => err?.response?.data?.errors || {};
export const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;
