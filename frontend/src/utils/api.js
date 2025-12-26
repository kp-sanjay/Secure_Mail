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
  updatePublicKey: (publicKey) => api.put('/users/public-key', { publicKey }),
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
  updateEmailCategory: (id, category, securityScore) =>
    api.put(`/emails/${id}/category`, { category, securityScore }),
};

export default api;

