import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/api'
import type { User } from '@/types'

interface AuthState {
    user: User | null
    accessToken: string | null
    refreshToken: string | null
    isAuthenticated: boolean
    isLoading: boolean
    isHydrated: boolean  // NEW: Track hydration status

    // Actions
    login: (email: string, password: string) => Promise<void>
    signup: (name: string, email: string, password: string) => Promise<void>
    logout: () => void
    setTokens: (access: string, refresh: string) => void
    refreshAccessToken: () => Promise<boolean>
    fetchProfile: () => Promise<void>
    updateCredits: (newBalance: number) => void
    setHydrated: (hydrated: boolean) => void  // NEW: Hydration setter
    initializeAuth: () => Promise<void>  // NEW: Initialize auth on app load
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            isHydrated: false,  // Start as not hydrated

            login: async (email: string, password: string) => {
                set({ isLoading: true })
                try {
                    const response = await api.post('/auth/login/', { email, password })
                    const { tokens, user } = response.data
                    const { access, refresh } = tokens

                    // Persist tokens to localStorage explicitly
                    localStorage.setItem('access_token', access)
                    localStorage.setItem('refresh_token', refresh)

                    set({
                        user,
                        accessToken: access,
                        refreshToken: refresh,
                        isAuthenticated: true,
                    })
                } finally {
                    set({ isLoading: false })
                }
            },

            signup: async (name: string, email: string, password: string) => {
                set({ isLoading: true })
                try {
                    // Register new user
                    await api.post('/auth/signup/', {
                        name,
                        email,
                        password,
                        password_confirm: password,
                    })

                    // Auto-login after signup
                    await get().login(email, password)
                } finally {
                    set({ isLoading: false })
                }
            },

            logout: () => {
                // Call backend to set offline status (fire and forget)
                api.post('/auth/logout/').catch(err => console.error('Logout failed:', err))

                // Clear localStorage tokens
                localStorage.removeItem('access_token')
                localStorage.removeItem('refresh_token')

                set({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                })
            },

            setTokens: (access: string, refresh: string) => {
                localStorage.setItem('access_token', access)
                localStorage.setItem('refresh_token', refresh)

                set({
                    accessToken: access,
                    refreshToken: refresh,
                    isAuthenticated: true,
                })
            },

            refreshAccessToken: async () => {
                const { refreshToken } = get()
                if (!refreshToken) return false

                try {
                    const response = await api.post('/auth/token/refresh/', {
                        refresh: refreshToken,
                    })
                    const newAccessToken = response.data.access

                    localStorage.setItem('access_token', newAccessToken)
                    set({ accessToken: newAccessToken })
                    return true
                } catch {
                    get().logout()
                    return false
                }
            },

            fetchProfile: async () => {
                try {
                    const response = await api.get('/users/me/')
                    set({ user: response.data })
                } catch (error) {
                    console.error('Failed to fetch profile:', error)
                }
            },

            // Called by sessionStore when credits update via WebSocket
            updateCredits: (newBalance: number) => {
                set((state) => ({
                    user: state.user ? { ...state.user, credits: newBalance } : null,
                }))
            },

            setHydrated: (hydrated: boolean) => {
                set({ isHydrated: hydrated })
            },

            // Initialize auth state on app load
            initializeAuth: async () => {
                const { accessToken, isAuthenticated } = get()

                // If we have a token and are authenticated, fetch the user profile
                if (accessToken && isAuthenticated) {
                    try {
                        await get().fetchProfile()
                    } catch (error) {
                        // Token might be expired, try to refresh
                        const refreshed = await get().refreshAccessToken()
                        if (refreshed) {
                            await get().fetchProfile()
                        }
                    }
                }
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                isAuthenticated: state.isAuthenticated,
                user: state.user,
            }),
            onRehydrateStorage: () => (state) => {
                // Called when hydration completes
                if (state) {
                    state.setHydrated(true)
                    // Initialize auth after hydration
                    state.initializeAuth()
                }
            },
        }
    )
)
