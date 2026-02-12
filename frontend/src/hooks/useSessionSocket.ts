import { useEffect, useRef, useCallback, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import type { Session, SessionTimer } from '@/types'

interface SessionSocketState {
    isConnected: boolean
    session: Session | null
    activeTimer: SessionTimer | null
    yourCredits: number
    error: string | null
}

interface SessionSocketActions {
    startTimer: () => void
    stopTimer: () => void
    endSession: () => void
    reconnect: () => void
    sendMessage: (type: string, data?: Record<string, unknown>) => void
    sendWhiteboard: (data: unknown) => void
    sendCode: (data: unknown) => void
}

const WS_BASE = import.meta.env?.VITE_WS_URL || 'ws://127.0.0.1:8000'
const RECONNECT_DELAY = 3000

export function useSessionSocket(sessionId: string | number | undefined): SessionSocketState & SessionSocketActions {
    const [isConnected, setIsConnected] = useState(false)
    const [session, setSession] = useState<Session | null>(null)
    const [activeTimer, setActiveTimer] = useState<SessionTimer | null>(null)
    const [yourCredits, setYourCredits] = useState(0)
    const [error, setError] = useState<string | null>(null)

    const socketRef = useRef<WebSocket | null>(null)
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Only subscribe to essential auth state changes that effectively require a reconnect (like token)
    const accessToken = useAuthStore(state => state.accessToken)
    const isAuthenticated = useAuthStore(state => state.isAuthenticated)
    // For user ID and actions, we can access them directly or via getState to avoid re-triggering 'connect'
    // However, if we want to update UI based on credits, we need local state (which we have: yourCredits)

    const connect = useCallback(() => {
        const id = String(sessionId)

        if (!sessionId || id === 'undefined' || id === 'NaN' || !accessToken || !isAuthenticated) {
            return
        }

        // Prevent double connection
        if (socketRef.current) {
            if (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING) {
                return
            }
        }

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
        }

        const wsUrl = `${WS_BASE}/ws/session/${sessionId}/?token=${accessToken}`
        const socket = new WebSocket(wsUrl)

        socket.onopen = () => {
            console.log('DEBUG: Session WebSocket Connected')
            setIsConnected(true)
            setError(null)
        }

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                console.log('DEBUG: Session Socket Message', data.type)

                // Access fresh store state without adding to dependencies
                const currentUser = useAuthStore.getState().user
                const updateCredits = useAuthStore.getState().updateCredits

                switch (data.type) {
                    case 'session_state':
                        console.log('DEBUG: Setting Session State', data.session)
                        setSession(data.session)
                        setActiveTimer(data.session.active_timer)
                        break

                    case 'timer_started':
                        setActiveTimer({
                            id: data.timer_id,
                            teacher: data.teacher_id,
                            teacher_name: data.teacher_name,
                            start_time: data.start_time,
                            end_time: null,
                            duration_seconds: null,
                            is_running: true,
                        })
                        break

                    case 'timer_stopped':
                        setActiveTimer(null)
                        if (data.new_total_time !== undefined) {
                            setSession(prev => {
                                if (!prev) return null
                                const user1Id = String(prev.user1)
                                const teacherId = String(data.teacher_id)
                                if (teacherId === user1Id) {
                                    return { ...prev, user1_teaching_time: data.new_total_time }
                                } else {
                                    return { ...prev, user2_teaching_time: data.new_total_time }
                                }
                            })
                        }
                        break

                    case 'session_ended':
                        setSession(prev => prev ? { ...prev, is_active: false } : null)
                        setActiveTimer(null)
                        if (data.your_credits !== undefined) {
                            setYourCredits(data.your_credits)
                            updateCredits(data.your_credits)
                        }
                        break

                    case 'credit_update':
                        if (data.user_id === currentUser?.id) {
                            setYourCredits(data.new_balance)
                            updateCredits(data.new_balance)
                        }
                        break

                    case 'signal':
                        if (data.payload) {
                            window.dispatchEvent(new CustomEvent('remote_peer_id', {
                                detail: {
                                    peerId: 'peer',
                                    ...data.payload
                                }
                            }))
                        }
                        break

                    case 'whiteboard_update':
                        window.dispatchEvent(new CustomEvent('whiteboard_update', {
                            detail: { data: data.data }
                        }))
                        break

                    case 'code_update':
                        window.dispatchEvent(new CustomEvent('code_update', {
                            detail: { data: data.data }
                        }))
                        break

                    case 'error':
                        setError(data.message || 'An error occurred')
                        break
                }
            } catch (error) {
                console.error('Failed to parse session message:', error)
            }
        }

        socket.onclose = (event) => {
            setIsConnected(false)

            // Auto-reconnect if still authenticated and session is active
            if (useAuthStore.getState().isAuthenticated && event.code !== 4003) {
                reconnectTimeoutRef.current = setTimeout(() => {
                    connect()
                }, RECONNECT_DELAY)
            }
        }

        socket.onerror = () => {
            setError('Connection error')
            if (socket.readyState === WebSocket.OPEN) {
                socket.close()
            }
        }

        socketRef.current = socket
    }, [sessionId, accessToken, isAuthenticated])

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
        }
        if (socketRef.current) {
            socketRef.current.close()
            socketRef.current = null
        }
        setIsConnected(false)
    }, [])

    const reconnect = useCallback(() => {
        disconnect()
        setTimeout(connect, 100)
    }, [connect, disconnect])

    const sendMessage = useCallback((type: string, data: Record<string, unknown> = {}) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type, ...data }))
        }
    }, [])

    const sendWhiteboard = useCallback((data: unknown) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'whiteboard_update',
                data
            }))
        }
    }, [])

    const sendCode = useCallback((data: unknown) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'code_update',
                data
            }))
        }
    }, [])

    const startTimer = useCallback(() => {
        sendMessage('timer_start')
    }, [sendMessage])

    const stopTimer = useCallback(() => {
        sendMessage('timer_stop')
    }, [sendMessage])

    const endSession = useCallback(() => {
        sendMessage('end_session')
    }, [sendMessage])

    // Connect on mount
    useEffect(() => {
        console.log('DEBUG: useSessionSocket Effect Triggered', { sessionId, isAuthenticated, hasToken: !!accessToken })
        if (sessionId && isAuthenticated && accessToken) {
            connect()
        }
        return () => {
            console.log('DEBUG: useSessionSocket Effect Cleanup')
            disconnect()
        }
    }, [sessionId, isAuthenticated, accessToken, connect, disconnect])

    // Initialize credits from user
    useEffect(() => {
        const user = useAuthStore.getState().user
        if (user?.credits !== undefined) {
            setYourCredits(Number(user.credits))
        }
    }, [isAuthenticated]) // Only reset on fresh auth, or we could listen to store changes cautiously

    return {
        isConnected,
        session,
        activeTimer,
        yourCredits,
        error,
        startTimer,
        stopTimer,
        endSession,
        reconnect,
        sendMessage,
        sendWhiteboard,
        sendCode,
    }
}
