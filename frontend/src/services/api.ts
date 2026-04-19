import axios from 'axios';

const defaultApiBase =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3000/api`
    : 'http://localhost:3000/api';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultApiBase,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    console.error('API错误:', error);
    return Promise.reject(error);
  }
);

export default api;
