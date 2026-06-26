import { socketService } from './socketService';

const API_URL = '/api';

export const api = {
  get: async (endpoint: string) => request(endpoint, { method: 'GET' }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post: async (endpoint: string, data?: any) =>
    request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch: async (endpoint: string, data?: any) =>
    request(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put: async (endpoint: string, data?: any) =>
    request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (endpoint: string) => request(endpoint, { method: 'DELETE' }),
};

async function request(endpoint: string, options: RequestInit) {
  // Include the socket ID so the server can exclude the sender from broadcasts,
  // preventing the creator from receiving duplicate socket events for their own actions.
  const socketId = socketService.getSocket()?.id ?? '';
  const headers = {
    'Content-Type': 'application/json',
    'X-Socket-Id': socketId,
    ...options.headers,
  };
  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers, credentials: 'include' });

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMsg = errorData.error || errorMsg;
    } catch {
      // Ignored
    }
    throw new Error(errorMsg);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}
