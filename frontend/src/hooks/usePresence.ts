import { useEffect, useRef, useCallback, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { usePresenceStore } from '@/stores/presenceStore'


const WS_BASE = import.meta.env?.VITE_WS_URL || 'ws://127.0.0.1:8000'
const HEARTBEAT_INTERVAL = 30000 // 30 seconds
const RECONNECT_DELAY = 3000 // 3 seconds

export function usePresence() {
    const [isConnected, setIsConnected] = useState(false)
    const socketRef = useRef<WebSocket | null>(null)
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const { accessToken, isAuthenticated } = useAuthStore()
    const { setOnlineUsers, addUser, removeUser } = usePresenceStore()

    const connect = useCallback(() => {
        if (!accessToken || !isAuthenticated) return

        // Prevent multiple connections
        if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) {
            return
        }

        // 1. Check if token is expired
        try {
            const payload = JSON.parse(atob(accessToken.split('.')[1]))
            if (payload.exp * 1000 < Date.now()) {
                console.warn('Token expired, skipping connection')
                return
            }
        } catch (e) {
            console.error('Invalid token format', e)
            return
        }

        // Lazy connect to avoid React Strict Mode double-invocation issues
        const timer = setTimeout(() => {
            // Double check state before actually creating socket
            if (!accessToken || !isAuthenticated) return
            if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) return

            console.log('DEBUG: Connecting Presence WebSocket...')
            const wsUrl = `${WS_BASE}/ws/presence/?token=${accessToken}`
            const socket = new WebSocket(wsUrl)
            socketRef.current = socket

            socket.onopen = () => {
                console.log('DEBUG: Presence WebSocket Connected')
                setIsConnected(true)

                // Start heartbeat
                heartbeatRef.current = setInterval(() => {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({
                            type: 'heartbeat',
                            timestamp: Date.now()
                        }))
                    }
                }, HEARTBEAT_INTERVAL)
            }

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)

                    switch (data.type) {
                        case 'online_users':
                            setOnlineUsers(data.users || [])
                            break
                        case 'presence_update':
                            if (data.status === 'online') addUser(data.user)
                            else removeUser(data.user.id)
                            break
                    }
                } catch (error) {
                    console.error('Failed to parse presence message:', error)
                }
            }

            socket.onclose = () => {
                setIsConnected(false)
                socketRef.current = null

                if (heartbeatRef.current) {
                    clearInterval(heartbeatRef.current)
                    heartbeatRef.current = null
                }

                // Only reconnect if authenticated and not explicitly disconnected
                if (useAuthStore.getState().isAuthenticated) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect()
                    }, RECONNECT_DELAY)
                }
            }

            socket.onerror = () => {
                if (socket.readyState === WebSocket.OPEN) socket.close()
            }
        }, 100) // 100ms delay to allow React Strict Mode to unmount first

        // Store timer to clear it if unmounted immediately
        // We'll use a separate ref or just the cleanup function of the effect calling this
        // But since 'connect' is called by effect, we can return the cleanup from connect? 
        // No, 'connect' is a callback. 
        // We can attach the timer to a ref.
        reconnectTimeoutRef.current = timer

    }, [accessToken, isAuthenticated, setOnlineUsers, addUser, removeUser])

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
        }
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current)
            heartbeatRef.current = null
        }

        const socket = socketRef.current
        if (socket) {
            // Remove listeners to prevent "closed" event from triggering reconnect
            socket.onclose = null
            socket.onerror = null
            socket.close()
            socketRef.current = null
        }
        setIsConnected(false)
        setOnlineUsers([])
    }, [setOnlineUsers])

    useEffect(() => {
        if (isAuthenticated && accessToken) {
            connect()
        }
        return () => {
            disconnect()
        }
    }, [isAuthenticated, accessToken, connect, disconnect])

    const reconnect = useCallback(() => {
        disconnect()
        connect()
    }, [connect, disconnect])

    return {
        isConnected,
        reconnect,
    }
}
