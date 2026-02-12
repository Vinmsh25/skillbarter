import { useEffect, useRef, useCallback, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'

interface ChatMessage {
    sender: string
    message: string
    timestamp: string
}

interface ChatSocketState {
    isConnected: boolean
    messages: ChatMessage[]
}

interface ChatSocketActions {
    sendMessage: (message: string) => void
    reconnect: () => void
}

const WS_BASE = import.meta.env?.VITE_WS_URL || 'ws://127.0.0.1:8000'
const RECONNECT_DELAY = 3000

export function useChatSocket(sessionId: string | number | undefined): ChatSocketState & ChatSocketActions {
    const [isConnected, setIsConnected] = useState(false)
    const [messages, setMessages] = useState<ChatMessage[]>([])

    const socketRef = useRef<WebSocket | null>(null)
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const { accessToken, isAuthenticated } = useAuthStore()

    const connect = useCallback(() => {
        const id = String(sessionId)
        if (!sessionId || id === 'undefined' || id === 'NaN' || !accessToken || !isAuthenticated) return
        if (socketRef.current?.readyState === WebSocket.OPEN) return

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
        }

        const wsUrl = `${WS_BASE}/ws/chat/${sessionId}/?token=${accessToken}`
        const socket = new WebSocket(wsUrl)

        socket.onopen = () => {
            setIsConnected(true)
        }

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)

                switch (data.type) {
                    case 'chat_message':
                        setMessages(prev => [...prev, {
                            sender: data.sender,
                            message: data.message,
                            timestamp: data.timestamp || new Date().toISOString(),
                        }])
                        break

                    case 'chat_history':
                        if (Array.isArray(data.messages)) {
                            setMessages(data.messages)
                        }
                        break
                }
            } catch (error) {
                console.error('Failed to parse chat message:', error)
            }
        }

        socket.onclose = () => {
            setIsConnected(false)

            // Auto-reconnect if still authenticated
            if (useAuthStore.getState().isAuthenticated) {
                reconnectTimeoutRef.current = setTimeout(() => {
                    connect()
                }, RECONNECT_DELAY)
            }
        }

        socket.onerror = () => {
            socket.close()
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
        setMessages([])
    }, [])

    const reconnect = useCallback(() => {
        disconnect()
        setTimeout(connect, 100)
    }, [connect, disconnect])

    const sendMessage = useCallback((message: string) => {
        if (socketRef.current?.readyState === WebSocket.OPEN && message.trim()) {
            socketRef.current.send(JSON.stringify({
                type: 'chat_message',
                message: message.trim(),
            }))
        }
    }, [])

    // Connect on mount
    useEffect(() => {
        if (sessionId && isAuthenticated && accessToken) {
            connect()
        }
        return () => disconnect()
    }, [sessionId, isAuthenticated, accessToken, connect, disconnect])

    return {
        isConnected,
        messages,
        sendMessage,
        reconnect,
    }
}
