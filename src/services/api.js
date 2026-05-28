const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const getHeaders = (isMultipart = false) => {
  const headers = {};
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

const handleResponse = async (response) => {
  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const errData = await response.json();
      errorMsg = errData.detail || errorMsg;
    } catch (e) {
      errorMsg = response.statusText || errorMsg;
    }
    
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Dispatch custom event to let auth context know we logged out
      window.dispatchEvent(new Event('auth-logout'));
    }
    
    throw new Error(errorMsg);
  }
  
  if (response.status === 204) return null;
  return response.json();
};

export const api = {
  // Auth Service Endpoints
  auth: {
    register: async (username, email, password) => {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ username, email, password }),
      });
      return handleResponse(res);
    },
    
    login: async (username, password) => {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      
      const res = await fetch(`${BASE_URL}/api/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });
      return handleResponse(res);
    },
    
    getMe: async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
  },
  
  // Receipts Management Endpoints
  receipts: {
    upload: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`${BASE_URL}/api/receipts/upload`, {
        method: 'POST',
        headers: getHeaders(true), // isMultipart = true
        body: formData,
      });
      return handleResponse(res);
    },
    
    getHistory: async (filters = {}) => {
      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.startDate) queryParams.append('start_date', filters.startDate);
      if (filters.endDate) queryParams.append('end_date', filters.endDate);
      
      const url = `${BASE_URL}/api/receipts/history?${queryParams.toString()}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    
    deleteReceipt: async (id) => {
      const res = await fetch(`${BASE_URL}/api/receipts/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
    
    updateReceipt: async (id, receiptData) => {
      const res = await fetch(`${BASE_URL}/api/receipts/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(receiptData),
      });
      return handleResponse(res);
    },
  },
  
  // Dashboard Metrics & Charts
  dashboard: {
    getSummary: async () => {
      const res = await fetch(`${BASE_URL}/api/dashboard`, {
        method: 'GET',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
  },
  
  // PDF Exporter Report Downloader
  reports: {
    downloadPDF: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/api/reports/export`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error('Failed to generate spending report PDF.');
      }
      return res.blob();
    }
  },
  
  // AI Chat Assistant
  chat: {
    sendMessage: async (message, history = []) => {
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message, history }),
      });
      return handleResponse(res);
    },
  },
  
  // Utility function to get absolute upload paths for image tags
  getUploadUrl: (imagePath) => {
    if (!imagePath) return null;
    // Replace backslashes with slashes (in case of windows file systems)
    const normalized = imagePath.replace(/\\/g, '/');
    // Ensure path starts relative to base
    const relativePath = normalized.startsWith('./') ? normalized.slice(2) : normalized;
    return `${BASE_URL}/${relativePath}`;
  }
};

export const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
};

