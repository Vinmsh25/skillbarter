import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
})

// Helper to get access token from store or localStorage fallback
const getAccessToken = (): string | null => {
    // Try store first
    const storeToken = useAuthStore.getState().accessToken
    if (storeToken) return storeToken

    // Fallback to localStorage (for cases before hydration completes)
    return localStorage.getItem('access_token')
}

// Helper to get refresh token from store or localStorage fallback
const getRefreshToken = (): string | null => {
    const storeToken = useAuthStore.getState().refreshToken
    if (storeToken) return storeToken

    return localStorage.getItem('refresh_token')
}

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
    (config) => {
        const token = getAccessToken()
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => Promise.reject(error)
)

// Response Interceptor: Handle Token Refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config

        // Don't intercept auth endpoints - let them throw so the page can show errors
        const isAuthEndpoint = originalRequest?.url?.includes('/auth/')
        if (isAuthEndpoint) {
            return Promise.reject(error)
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true

            try {
                const refreshToken = getRefreshToken()
                if (!refreshToken) throw new Error('No refresh token')

                const response = await axios.post('/api/auth/token/refresh/', {
                    refresh: refreshToken,
                })

                const newAccessToken = response.data.access

                // Update both store and localStorage
                localStorage.setItem('access_token', newAccessToken)
                useAuthStore.getState().setTokens(newAccessToken, refreshToken)

                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
                return api(originalRequest)
            } catch (refreshError) {
                // Clear everything on refresh failure
                localStorage.removeItem('access_token')
                localStorage.removeItem('refresh_token')
                useAuthStore.getState().logout()
                window.location.href = '/login'
                return Promise.reject(refreshError)
            }
        }

        return Promise.reject(error)
    }
)

export default api
