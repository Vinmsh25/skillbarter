import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSessionSocket } from '@/hooks/useSessionSocket'
import { useChatSocket } from '@/hooks/useChatSocket'
import { useSessionsStore } from '@/stores/sessionsStore'
import { useAuthStore } from '@/stores/authStore'
import clsx from 'clsx'

// Session Components
import Whiteboard from '@/components/session/Whiteboard'
import VideoCall from '@/components/session/VideoCall'
import CodeEditor from '@/components/session/CodeEditor'
import SessionTimer from '@/components/session/SessionTimer'
import ReviewForm from '@/components/ReviewForm'

type LayoutMode = 'whiteboard' | 'video' | 'code'

interface ChatPanelProps {
    className?: string
    messages: Array<{ sender: string; message: string; timestamp: string }>
    onSendMessage: (message: string) => void
    isConnected: boolean
}

function ChatPanel({ className, messages, onSendMessage, isConnected }: ChatPanelProps) {
    const [inputValue, setInputValue] = useState('')
    const { user } = useAuthStore()
    const scrollRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const formatTimestamp = (isoString?: string) => {
        if (!isoString) return ''
        const date = new Date(isoString)
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (inputValue.trim()) {
            onSendMessage(inputValue)
            setInputValue('')
        }
    }

    return (
        <div className={clsx('flex flex-col', className)}>
            <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold">Chat</h3>
                <span className={clsx(
                    'w-2 h-2 rounded-full',
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                )} />
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">No messages yet</p>
                ) : (
                    messages.map((msg, i) => {
                        const isMe = msg.sender === user?.name
                        return (
                            <div
                                key={i}
                                className={clsx(
                                    'flex flex-col max-w-[85%]',
                                    isMe ? 'ml-auto items-end' : 'items-start'
                                )}
                            >
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{msg.sender}</span>
                                    <span className="text-[10px] text-slate-500">{formatTimestamp(msg.timestamp)}</span>
                                </div>
                                <div
                                    className={clsx(
                                        'px-3 py-2 rounded-2xl text-sm shadow-sm',
                                        isMe
                                            ? 'bg-primary text-white rounded-tr-none'
                                            : 'bg-slate-700 text-slate-200 rounded-tl-none'
                                    )}
                                >
                                    {msg.message}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            <form onSubmit={handleSubmit} className="p-3 border-t border-slate-700">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type a message..."
                        className="input flex-1 text-sm"
                        disabled={!isConnected}
                    />
                    <button
                        type="submit"
                        className="btn-primary px-4"
                        disabled={!isConnected || !inputValue.trim()}
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    )
}

export default function SessionPage() {
    const { sessionId } = useParams<{ sessionId: string }>()
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { fetchSession } = useSessionsStore()

    const sessionSocket = useSessionSocket(sessionId)
    const chatSocket = useChatSocket(sessionId)

    const [activeMode, setActiveMode] = useState<LayoutMode>('whiteboard')
    const [showReviewModal, setShowReviewModal] = useState(false)
    const [isEnding, setIsEnding] = useState(false)

    // Resizing logic
    const [sidePanelWidth, setSidePanelWidth] = useState(350)
    const [isResizing, setIsResizing] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsResizing(true)
    }, [])

    const stopResizing = useCallback(() => {
        setIsResizing(false)
    }, [])

    const resize = useCallback(
        (e: MouseEvent) => {
            if (isResizing && containerRef.current) {
                const containerRect = containerRef.current.getBoundingClientRect()
                const newWidth = containerRect.right - e.clientX
                if (newWidth > 280 && newWidth < 600) {
                    setSidePanelWidth(newWidth)
                }
            }
        },
        [isResizing]
    )

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize)
            window.addEventListener('mouseup', stopResizing)
        } else {
            window.removeEventListener('mousemove', resize)
            window.removeEventListener('mouseup', stopResizing)
        }
        return () => {
            window.removeEventListener('mousemove', resize)
            window.removeEventListener('mouseup', stopResizing)
        }
    }, [isResizing, resize, stopResizing])

    useEffect(() => {
        const id = parseInt(sessionId || '')
        if (!isNaN(id)) {
            fetchSession(id)
        }
    }, [sessionId, fetchSession])

    // Show review modal when session ends
    useEffect(() => {
        if (sessionSocket.session && !sessionSocket.session.is_active && !showReviewModal) {
            setShowReviewModal(true)
        }
    }, [sessionSocket.session?.is_active, showReviewModal])

    const handleEndSession = async () => {
        setIsEnding(true)
        try {
            sessionSocket.endSession()
        } finally {
            setIsEnding(false)
        }
    }

    const handleLeaveSession = () => {
        navigate('/search')
    }

    if (!sessionId || sessionId === 'undefined' || !user) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4 animate-fade-in">
                <div className="text-center space-y-2">
                    <p className="text-slate-400 text-lg">Loading session or invalid session ID...</p>
                    <p className="text-xs text-slate-500 font-mono">
                        Debug: ID={sessionId || 'missing'}, User={user ? 'present' : 'missing'}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/search')}
                    className="btn-primary"
                >
                    Back to Search
                </button>
            </div>
        )
    }

    const modes: { id: LayoutMode; label: string; icon: string }[] = [
        { id: 'whiteboard', label: 'Whiteboard', icon: '🎨' },
        { id: 'video', label: 'Video', icon: '📹' },
        { id: 'code', label: 'IDE', icon: '💻' },
    ]

    const peerName = sessionSocket.session
        ? (sessionSocket.session.user1 === user.id
            ? sessionSocket.session.user2_name
            : sessionSocket.session.user1_name)
        : 'Peer'

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col animate-fade-in">
            {/* Top Bar */}
            <div className="flex items-center justify-between p-4 glass border-b border-white/10">
                <div className="flex items-center gap-4">
                    <h1 className="font-bold">Session with {peerName}</h1>
                    <div className="flex items-center gap-2">
                        <span className={clsx(
                            'w-2 h-2 rounded-full',
                            sessionSocket.isConnected ? 'bg-green-500' : 'bg-slate-500'
                        )} />
                        <span className="text-sm text-slate-400">
                            {sessionSocket.isConnected ? 'Connected' : 'Connecting...'}
                        </span>
                    </div>
                </div>

                {/* Mode Switcher */}
                <div className="flex items-center gap-1 p-1 bg-surface-elevated rounded-lg">
                    {modes.map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => setActiveMode(mode.id)}
                            className={clsx(
                                'px-4 py-2 rounded-md text-sm font-medium transition-all',
                                activeMode === mode.id
                                    ? 'bg-primary text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white hover:bg-surface'
                            )}
                        >
                            <span className="mr-2">{mode.icon}</span>
                            {mode.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    {sessionSocket.session?.is_active ? (
                        <button
                            onClick={handleEndSession}
                            disabled={isEnding}
                            className="btn-secondary text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 px-6"
                        >
                            {isEnding ? 'Ending...' : 'End Session'}
                        </button>
                    ) : (
                        <button
                            onClick={handleLeaveSession}
                            className="btn-secondary text-sm"
                        >
                            Leave
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div ref={containerRef} className="flex-1 flex gap-0 p-2 overflow-hidden relative min-h-0 w-full">
                {/* Primary Panel */}
                <div className="flex-1 w-0 card !p-0 overflow-hidden min-w-0 flex flex-col h-full bg-surface-elevated">
                    <div className={clsx('h-full w-full relative', activeMode !== 'whiteboard' && 'hidden')}>
                        <Whiteboard
                            sessionId={sessionId}
                            isVisible={activeMode === 'whiteboard'}
                            onSendData={sessionSocket.sendWhiteboard}
                        />
                    </div>

                    <div className={clsx('h-full w-full relative', activeMode !== 'video' && 'hidden')}>
                        <VideoCall
                            sessionId={sessionId}
                            onSignal={sessionSocket.sendMessage}
                        />
                    </div>

                    <div className={clsx('h-full w-full relative', activeMode !== 'code' && 'hidden')}>
                        <CodeEditor
                            sessionId={sessionId}
                            isVisible={activeMode === 'code'}
                            onCodeChange={sessionSocket.sendCode}
                        />
                    </div>
                </div>

                {/* Resizer Handle */}
                <div
                    onMouseDown={startResizing}
                    className={clsx(
                        'w-3 cursor-col-resize flex-shrink-0 group relative z-10',
                        isResizing && 'bg-primary/20'
                    )}
                >
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-white/10 group-hover:bg-primary transition-colors h-full" />
                </div>

                {/* Right Panel */}
                <div
                    style={{ width: `${sidePanelWidth}px` }}
                    className="flex flex-col gap-4 flex-shrink-0 min-w-[280px] h-full overflow-hidden"
                >
                    {/* Timer */}
                    <SessionTimer
                        activeTimer={sessionSocket.activeTimer}
                        onStartTimer={sessionSocket.startTimer}
                        onStopTimer={sessionSocket.stopTimer}
                        yourCredits={sessionSocket.yourCredits}
                        isSessionActive={sessionSocket.session?.is_active ?? false}
                        accumulatedSeconds={
                            sessionSocket.session
                                ? (sessionSocket.activeTimer?.is_running
                                    ? (sessionSocket.activeTimer.teacher === sessionSocket.session.user1
                                        ? sessionSocket.session.user1_teaching_time
                                        : sessionSocket.session.user2_teaching_time)
                                    : (user?.id === sessionSocket.session.user1
                                        ? sessionSocket.session.user1_teaching_time
                                        : sessionSocket.session.user2_teaching_time))
                                : 0
                        }
                    />

                    {/* Chat - Flex 1 to take remaining height */}
                    <ChatPanel
                        className="flex-1 card !p-0 overflow-hidden flex flex-col min-h-0"
                        messages={chatSocket.messages}
                        onSendMessage={chatSocket.sendMessage}
                        isConnected={chatSocket.isConnected}
                    />
                </div>
            </div>

            {/* Review Modal */}
            {showReviewModal && sessionSocket.session && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
                    <div className="card max-w-md w-full mx-4">
                        <h2 className="text-xl font-bold mb-4">Session Ended</h2>
                        <p className="text-slate-400 mb-6">
                            Your session with {peerName} has ended.
                            Would you like to leave a review?
                        </p>

                        <ReviewForm
                            sessionId={parseInt(sessionId || '0')}
                            onComplete={() => {
                                setShowReviewModal(false)
                                navigate('/search')
                            }}
                            onSkip={() => {
                                setShowReviewModal(false)
                                navigate('/search')
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Error Toast */}
            {sessionSocket.error && (
                <div className="fixed bottom-4 right-4 p-4 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 animate-slide-up">
                    {sessionSocket.error}
                </div>
            )}
        </div>
    )
}
