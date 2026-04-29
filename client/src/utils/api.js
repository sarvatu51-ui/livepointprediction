import axios from 'axios';

// Auto-detect backend URL
// In production (Vercel): uses REACT_APP_API_URL env variable
// In development (local): uses proxy via package.json
const BASE_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL + '/api'
  : '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Auto-attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
