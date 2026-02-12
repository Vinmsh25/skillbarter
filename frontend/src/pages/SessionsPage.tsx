import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSessionsStore } from '@/stores/sessionsStore'
import { useAuthStore } from '@/stores/authStore'

export default function SessionsPage() {
    const { sessions, isLoading, error, fetchSessions } = useSessionsStore()
    const { user } = useAuthStore()

    useEffect(() => {
        fetchSessions()
    }, [fetchSessions])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400">Loading sessions...</p>
                </div>
            </div>
        )
    }

    const activeSessions = sessions.filter(s => s.is_active)
    const pastSessions = sessions.filter(s => !s.is_active).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">My Sessions</h1>
                <Link to="/search" className="btn-primary">
                    Find New Session
                </Link>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                    {error}
                </div>
            )}

            {/* Active Sessions */}
            <section>
                <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Active Sessions ({activeSessions.length})
                </h2>

                {activeSessions.length === 0 ? (
                    <div className="card text-center py-8 text-slate-400">
                        <p className="text-xl mb-2">🔍</p>
                        <p>No active sessions</p>
                        <Link to="/search" className="text-primary-light hover:underline mt-2 inline-block">
                            Start learning →
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {activeSessions.map((session, index) => {
                            const peerName = session.user1 === user?.id
                                ? session.user2_name
                                : session.user1_name
                            const peerId = session.user1 === user?.id
                                ? session.user2
                                : session.user1
                            return (
                                <div key={session.id || `active-${index}`} className="flex flex-col gap-2">
                                    <Link
                                        to={`/session/${session.id}`}
                                        className="card hover:border-primary/50 transition-colors flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-lg font-bold">
                                                {peerName?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium">Session with {peerName}</p>
                                                <p className="text-sm text-slate-400">
                                                    Started {new Date(session.start_time).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full">
                                            Active
                                        </span>
                                    </Link>
                                    <Link
                                        to={`/user/${peerId}`}
                                        className="text-xs text-slate-500 hover:text-primary-light transition-colors ml-16"
                                    >
                                        View {peerName}'s Profile →
                                    </Link>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            {/* Past Sessions */}
            <section>
                <h2 className="text-lg font-semibold text-slate-300 mb-4">
                    Past Sessions ({pastSessions.length})
                </h2>

                {pastSessions.length === 0 ? (
                    <div className="card text-center py-8 text-slate-400">
                        <p>No past sessions yet</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {pastSessions.map((session, index) => {
                            const peerName = session.user1 === user?.id
                                ? session.user2_name
                                : session.user1_name
                            const peerId = session.user1 === user?.id
                                ? session.user2
                                : session.user1
                            return (
                                <div key={session.id || `past-${index}`} className="flex flex-col gap-2">
                                    <div
                                        className="card flex items-center justify-between opacity-75"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center text-lg font-bold">
                                                {peerName?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium">Session with {peerName}</p>
                                                <p className="text-sm text-slate-400">
                                                    {new Date(session.start_time).toLocaleDateString()} •
                                                    {session.end_time && ` Ended ${new Date(session.end_time).toLocaleTimeString()}`}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 bg-slate-700 text-slate-400 text-sm rounded-full">
                                            Ended
                                        </span>
                                    </div>
                                    <Link
                                        to={`/user/${peerId}`}
                                        className="text-xs text-slate-500 hover:text-primary-light transition-colors ml-16"
                                    >
                                        View {peerName}'s Profile →
                                    </Link>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>
        </div>
    )
}
