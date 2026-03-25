import axios from 'axios';

// API base URL - switches based on environment
const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// User API
export const userAPI = {
  updatePublicKey: (payload) => api.put('/users/public-key', payload),
  getPublicKeyByEmail: (email) => api.get(`/users/public-key/${email}`),
};

// Email API
export const emailAPI = {
  sendEmail: (data) => api.post('/emails', data),
  getInbox: () => api.get('/emails/inbox'),
  getSent: () => api.get('/emails/sent'),
  getEmail: (id) => api.get(`/emails/${id}`),
  saveDraft: (data) => api.post('/emails/draft', data),
  getDrafts: () => api.get('/emails/drafts'),
  deleteDraft: (id) => api.delete(`/emails/draft/${id}`),
  searchEmails: (query, folder) => api.get('/emails/search', { params: { query, folder } }),
  getThread: (threadId) => api.get(`/emails/thread/${threadId}`),
  updateEmailCategory: (id, body) => api.put(`/emails/${id}/category`, body),
};

// Quantum RNG API (currently simulated on backend)
export const qrngAPI = {
  getSeed: (bytes = 32) => api.get('/qrng/seed', { params: { bytes } }),
};

// Key Management Service API
export const kmsAPI = {
  publishKeys: (payload) => api.put('/kms/keys', payload),
  getMyKeys: () => api.get('/kms/me'),
  getKeysByEmail: (email) => api.get(`/kms/keys/${email}`),
  revoke: (payload) => api.post('/kms/revoke', payload),
};

// AI assistant APIs (template/FAQ backed by default)
export const aiAPI = {
  compose: (payload) => api.post('/ai/compose', payload),
  chat: (payload) => api.post('/ai/chat', payload),
};

export const calendarAPI = {
  list: (params) => api.get('/calendar', { params }),
  create: (payload) => api.post('/calendar', payload),
  update: (id, payload) => api.put(`/calendar/${id}`, payload),
  remove: (id) => api.delete(`/calendar/${id}`),
};

export default api;

