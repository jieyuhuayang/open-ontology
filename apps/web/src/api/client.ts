import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorData = error.response?.data?.error;
    if (errorData) {
      console.error(`[API Error] ${errorData.code}: ${errorData.message}`);
    }
    return Promise.reject(error);
  },
);

export default apiClient;
