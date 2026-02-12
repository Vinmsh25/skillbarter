import { create } from 'zustand'
import api from '@/lib/api'
import type { Session, Review, ReviewCreate } from '@/types'
import { useAuthStore } from './authStore'

interface SessionsState {
    sessions: Session[]
    currentSession: Session | null
    isLoading: boolean
    error: string | null

    // Actions
    fetchSessions: () => Promise<void>
    fetchSession: (id: number) => Promise<Session | null>
    createSession: (user2Id: number, learningRequestId?: number) => Promise<Session>
    endSession: (id: number) => Promise<void>
    submitReview: (sessionId: number, review: ReviewCreate) => Promise<Review>
    clearError: () => void
    setCurrentSession: (session: Session | null) => void
}

export const useSessionsStore = create<SessionsState>((set) => ({
    sessions: [],
    currentSession: null,
    isLoading: false,
    error: null,

    fetchSessions: async () => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get('/sessions/')
            // Handle paginated response (Django REST returns { results: [...] })
            const sessions = Array.isArray(response.data)
                ? response.data
                : (response.data?.results ?? [])
            set({ sessions, isLoading: false })
        } catch (error) {
            set({ error: 'Failed to load sessions', isLoading: false })
        }
    },

    fetchSession: async (id: number) => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get(`/sessions/${id}/`)
            const session = response.data
            set({ currentSession: session, isLoading: false })
            return session
        } catch (error) {
            set({ error: 'Failed to load session', isLoading: false })
            return null
        }
    },

    createSession: async (user2Id: number, learningRequestId?: number) => {
        set({ error: null })
        try {
            const payload: { user2: number; learning_request?: number } = { user2: user2Id }
            if (learningRequestId) {
                payload.learning_request = learningRequestId
            }

            const response = await api.post('/sessions/', payload)
            const newSession = response.data

            // Add to local state
            set((state) => ({
                sessions: [newSession, ...state.sessions],
                currentSession: newSession,
            }))

            return newSession
        } catch (error: unknown) {
            const err = error as { response?: { data?: { detail?: string } } }
            const message = err.response?.data?.detail || 'Failed to create session'
            set({ error: message })
            throw error
        }
    },

    endSession: async (id: number) => {
        try {
            const response = await api.post(`/sessions/${id}/end/`)
            const { credit_summary } = response.data

            // Update local session state
            set((state) => ({
                sessions: state.sessions.map((s) =>
                    s.id === id ? { ...s, is_active: false, end_time: new Date().toISOString() } : s
                ),
                currentSession: state.currentSession?.id === id
                    ? { ...state.currentSession, is_active: false, end_time: new Date().toISOString() }
                    : state.currentSession,
            }))

            // Sync credits to authStore
            if (credit_summary) {
                const currentUser = useAuthStore.getState().user
                if (currentUser) {
                    // Find current user's entry in summary
                    const user1Data = credit_summary.user1
                    const user2Data = credit_summary.user2

                    let newBalance = -1
                    if (user1Data.id === currentUser.id) {
                        // Backend response doesn't give new balance directly in summary, 
                        // so we should fetch profile or trust the summary if it had it.
                        // Actually, it's better to just trigger a profile fetch to be safe and accurate
                        useAuthStore.getState().fetchProfile()
                    } else if (user2Data.id === currentUser.id) {
                        useAuthStore.getState().fetchProfile()
                    }
                }
            }

            return response.data
        } catch (error: unknown) {
            const err = error as { response?: { data?: { detail?: string } } }
            set({ error: err.response?.data?.detail || 'Failed to end session' })
            throw error
        }
    },

    submitReview: async (sessionId: number, review: ReviewCreate) => {
        try {
            const response = await api.post(`/sessions/${sessionId}/reviews/`, review)
            return response.data
        } catch (error: unknown) {
            const err = error as { response?: { data?: { detail?: string } } }
            set({ error: err.response?.data?.detail || 'Failed to submit review' })
            throw error
        }
    },

    clearError: () => set({ error: null }),

    setCurrentSession: (session: Session | null) => set({ currentSession: session }),
}))
