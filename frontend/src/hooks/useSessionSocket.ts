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

const WS_BASE = import.meta.env?.VITE_WS_URL || 'ws://127.0.0.1:8001'
const RECONNECT_DELAY = 3000

export function useSessionSocket(sessionId: string | number | undefined): SessionSocketState & SessionSocketActions {
    const [isConnected, setIsConnected] = useState(false)
    const [session, setSession] = useState<Session | null>(null)
    const [activeTimer, setActiveTimer] = useState<SessionTimer | null>(null)
    const [yourCredits, setYourCredits] = useState(0)
    const [error, setError] = useState<string | null>(null)

    const socketRef = useRef<WebSocket | null>(null)
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const { accessToken, isAuthenticated, user, updateCredits } = useAuthStore()

    const connect = useCallback(() => {
        const id = String(sessionId)
        if (!sessionId || id === 'undefined' || id === 'NaN' || !accessToken || !isAuthenticated) return
        if (socketRef.current?.readyState === WebSocket.OPEN) return

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
        }

        const wsUrl = `${WS_BASE}/ws/session/${sessionId}/?token=${accessToken}`
        const socket = new WebSocket(wsUrl)

        socket.onopen = () => {
            setIsConnected(true)
            setError(null)
        }

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)

                switch (data.type) {
                    case 'session_state':
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
                        console.log('DEBUG: Timer stopped Payload:', data)
                        setActiveTimer(null)

                        if (data.new_total_time !== undefined) {
                            setSession(prev => {
                                if (!prev) {
                                    console.log('DEBUG: No previous session state')
                                    return null
                                }

                                const user1Id = String(prev.user1)
                                const teacherId = String(data.teacher_id)

                                console.log(`DEBUG: Comparing IDs: Teacher=${teacherId} vs User1=${user1Id}`)

                                if (teacherId === user1Id) {
                                    console.log(`DEBUG: Updating User1 time to ${data.new_total_time}`)
                                    const newState = { ...prev, user1_teaching_time: data.new_total_time }
                                    console.log('DEBUG: New Session State:', newState)
                                    return newState
                                } else {
                                    console.log(`DEBUG: Updating User2 time to ${data.new_total_time}`)
                                    return { ...prev, user2_teaching_time: data.new_total_time }
                                }
                            })
                        } else {
                            console.error('DEBUG: new_total_time is MISSING in payload!')
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
                        if (data.user_id === user?.id) {
                            setYourCredits(data.new_balance)
                            updateCredits(data.new_balance)
                        }
                        break

                    case 'signal':
                        // Dispatch generic signal event
                        if (data.payload) {
                            window.dispatchEvent(new CustomEvent('remote_peer_id', {
                                detail: {
                                    peerId: 'peer', // Dummy peerID if not provided, or update backend to send it
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
            socket.close()
        }

        socketRef.current = socket
    }, [sessionId, accessToken, isAuthenticated, user?.id, updateCredits])

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
        if (sessionId && isAuthenticated && accessToken) {
            connect()
        }
        return () => disconnect()
    }, [sessionId, isAuthenticated, accessToken, connect, disconnect])

    // Initialize credits from user
    useEffect(() => {
        if (user?.credits !== undefined) {
            setYourCredits(Number(user.credits))
        }
    }, [user?.credits])

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
