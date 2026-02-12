import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import type { SessionTimer as SessionTimerType } from '@/types'

interface SessionTimerProps {
    activeTimer: SessionTimerType | null
    onStartTimer: () => void
    onStopTimer: () => void
    yourCredits: number
    isSessionActive: boolean
    accumulatedSeconds: number
}

export default function SessionTimer({
    activeTimer,
    onStartTimer,
    onStopTimer,
    yourCredits,
    isSessionActive,
    accumulatedSeconds
}: SessionTimerProps) {
    const { user } = useAuthStore()
    const [currentElapsed, setCurrentElapsed] = useState(0)

    // Calculate elapsed time ONLY if timer is running
    useEffect(() => {
        if (!activeTimer?.is_running || !activeTimer.start_time) {
            setCurrentElapsed(0)
            return
        }

        const startTime = new Date(activeTimer.start_time).getTime()

        const updateElapsed = () => {
            const now = Date.now()
            // Ensure we don't get negative elapsed time if client clock is slightly behind
            const elapsed = Math.max(0, Math.floor((now - startTime) / 1000))
            setCurrentElapsed(elapsed)
        }

        updateElapsed()
        const interval = setInterval(updateElapsed, 1000)

        return () => clearInterval(interval)
    }, [activeTimer?.is_running, activeTimer?.start_time])

    // Total seconds = Accumulated (Past) + Elapsed (Current Session)
    const totalSeconds = accumulatedSeconds + currentElapsed

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        const secs = Math.floor(seconds % 60)

        if (hrs > 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    // System Rule: 5 minutes = 1 credit
    const creditsEarned = (totalSeconds / 300).toFixed(2)

    console.log('DEBUG: SessionTimer Render', { activeTimer, isSessionActive, accumulatedSeconds, currentElapsed, totalSeconds })

    const isRunning = !!activeTimer?.is_running
    const isMyTimer = activeTimer?.teacher === user?.id
    const isLocked = isRunning && !isMyTimer
    const hasStartedBefore = accumulatedSeconds > 0

    return (
        <div className="p-4 bg-surface-elevated rounded-lg transition-all duration-300">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                        Teaching Timer
                    </p>
                    <p className={`text-4xl font-mono font-bold transition-colors ${isRunning ? 'text-accent' : 'text-slate-300'}`}>
                        {formatTime(totalSeconds)}
                    </p>

                    {isRunning && (
                        <div className="flex flex-col gap-1 mt-2 animate-fade-in">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                                <span className="text-sm text-accent font-medium">
                                    ~{creditsEarned} credits earned
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-500 italic">
                                * Final amount subject to 10% bank cut
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    {isMyTimer ? (
                        <button
                            onClick={onStopTimer}
                            className="btn-secondary"
                            aria-label="Pause teaching timer"
                        >
                            ⏸ Pause
                        </button>
                    ) : (
                        <button
                            onClick={onStartTimer}
                            className="btn-primary"
                            aria-label={hasStartedBefore ? "Resume teaching timer" : "Start teaching timer"}
                            disabled={!isSessionActive || isLocked}
                            title={isLocked ? `${activeTimer?.teacher_name} is teaching` : ""}
                        >
                            {isLocked
                                ? `🔒 ${activeTimer?.teacher_name} is Teaching`
                                : (hasStartedBefore ? '▶ Resume' : '▶ Start Teaching')}
                        </button>
                    )}
                </div>
            </div>

            {isLocked && (
                <p className="mt-3 text-amber-400 text-sm flex items-center gap-2 animate-fade-in">
                    <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                    {activeTimer?.teacher_name} is teaching
                </p>
            )}

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-700/50 pt-2">
                <span>5 min = 1 credit • Bank takes 10% cut</span>
                <span className="text-primary-light font-medium">
                    Your credits: {Number(yourCredits).toFixed(2)}
                </span>
            </div>
        </div>
    )
}
