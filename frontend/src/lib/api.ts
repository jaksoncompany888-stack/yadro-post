import axios from 'axios'

// Используем относительные пути - nginx проксирует на backend
export const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// API methods
export const postsApi = {
  list: () => api.get('/api/posts'),
  get: (id: string) => api.get(`/api/posts/${id}`),
  create: (data: any) => api.post('/api/posts', data),
  update: (id: string, data: any) => api.put(`/api/posts/${id}`, data),
  delete: (id: string) => api.delete(`/api/posts/${id}`),
  publish: (id: string) => api.post(`/api/posts/${id}/publish`),
}

export const channelsApi = {
  list: () => api.get('/api/channels'),
  get: (id: string) => api.get(`/api/channels/${id}`),
  create: (data: any) => api.post('/api/channels', data),
  delete: (id: string) => api.delete(`/api/channels/${id}`),
  connectTelegram: (code: string) => api.post('/api/channels/telegram/connect', { code }),
  connectVK: (token: string, groupId: string) =>
    api.post('/api/channels/vk/connect', { access_token: token, group_id: groupId }),
}

export const calendarApi = {
  get: (view: string, date?: string) =>
    api.get('/api/calendar', { params: { view, date } }),
  getSlots: (date: string, channelIds: string[]) =>
    api.get('/api/calendar/slots', { params: { date, channel_ids: channelIds } }),
}

export const aiApi = {
  // Используем yadro-smm API
  generate: (data: {
    topic: string
    platform?: string
    style?: string
    language?: string
  }) => api.post('/api/posts/generate', { topic: data.topic }),
  edit: (data: { content: string; instruction: string }) =>
    api.post('/api/posts/edit', { text: data.content, instruction: data.instruction }),
  chat: (messages: { role: string; content: string }[], context?: string) =>
    api.post('/api/posts/generate', { topic: messages[messages.length - 1]?.content || '' }),
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', new URLSearchParams({ username: email, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),
  register: (data: { email: string; password: string; name?: string }) =>
    api.post('/api/auth/register', data),
  me: () => api.get('/api/auth/me'),
}
