// API Configuration
// In production, frontend is served by the same backend, so use relative URLs.
// In development, point to the local backend server.
const getApiUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // In the browser, use same origin (relative)
  if (typeof window !== 'undefined') {
    return '';
  }

  return 'http://localhost:5000';
};

export const API_URL = getApiUrl();

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  REFRESH: '/api/auth/refresh',
  LOGOUT: '/api/auth/logout',
  
  // Companies
  COMPANIES: '/api/companies',
  COMPANY_BY_ID: (id: number) => `/api/companies/${id}`,
  
  // Evaluations
  EVALUATIONS: '/api/evaluations',
  EVALUATION_BY_ID: (id: number) => `/api/evaluations/${id}`,
  EVALUATION_ASSIGN: (id: number) => `/api/evaluations/${id}/assign`,
  EVALUATION_PARTICIPANTS: (id: number) => `/api/participants/evaluation/${id}`,
  
  // Participants
  PARTICIPANTS: '/api/participants',
  PARTICIPANT_BY_ID: (id: number) => `/api/participants/${id}`,
  
  // Questionnaires
  QUESTIONNAIRES: '/api/questionnaires',
  QUESTIONNAIRE_BY_TYPE: (type: string) => `/api/questionnaires/${type}`,
  
  // Responses
  RESPONSES: '/api/responses',
  RESPONSE_BY_ID: (id: number) => `/api/responses/${id}`,
  RESPONSES_BY_PARTICIPANT: (evalId: number, partId: number) => `/api/responses/evaluation/${evalId}/participant/${partId}`,
  
  // Results
  CALCULATE_RESULTS: (participantId: number) => `/api/results/calculate/${participantId}`,
  RESULTS_BY_PARTICIPANT: (participantId: number) => `/api/results/participant/${participantId}`,
  RESULTS_BY_EVALUATION: (evaluationId: number) => `/api/results/evaluation/${evaluationId}`,
  
  // Reports
  REPORT_PDF: (participantId: number) => `/api/reports/participant/${participantId}/pdf`,
  REPORT_EVALUATION: (evaluationId: number) => `/api/reports/evaluation/${evaluationId}`,
  
  // System
  SYSTEM_HEALTH: '/api/system/health',
  SYSTEM_CONFIG: (key: string) => `/api/system/config/${key}`,
  SYSTEM_BAREMOS: '/api/system/baremos-summary',
};

// Helper function to make API calls
export const apiCall = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = localStorage.getItem('token');
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
  
  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };
  
  // Always use the dynamic API URL
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}${endpoint}`, config);
  
  // Handle unauthorized responses
  if (response.status === 401) {
    // Token might be expired, try to refresh
    const refreshResponse = await fetch(`${apiUrl}${API_ENDPOINTS.REFRESH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (refreshResponse.ok) {
      const { token: newToken } = await refreshResponse.json();
      localStorage.setItem('token', newToken);
      
      // Retry the original request with the new token
      return fetch(`${apiUrl}${endpoint}`, {
        ...config,
        headers: {
          ...config.headers,
          'Authorization': `Bearer ${newToken}`
        }
      });
    } else {
      // Refresh failed, redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/auth/login';
    }
  }
  
  return response;
};

// Type definitions for API responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Helper to handle API errors
export const handleApiError = (error: any): string => {
  if (error.response) {
    // Server responded with error
    return error.response.data?.error || error.response.data?.message || 'Error del servidor';
  } else if (error.request) {
    // Request made but no response
    return 'No se pudo conectar con el servidor';
  } else {
    // Something else happened
    return error.message || 'Error desconocido';
  }
};