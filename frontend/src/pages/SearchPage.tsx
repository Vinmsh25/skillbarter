import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { usePostsStore } from '@/stores/requestsStore'
import { useSessionsStore } from '@/stores/sessionsStore'
import { useAuthStore } from '@/stores/authStore'
import { usePresenceStore } from '@/stores/presenceStore'
import api from '@/lib/api'
import type { LearningPost } from '@/types'

// Simple User Interface
interface SearchedUser {
    id: number
    name: string
    is_online: boolean
    availability?: string
    average_rating: number | null
}

export default function SearchPage() {
    const [topicLearn, setTopicLearn] = useState('')
    const [topicTeach, setTopicTeach] = useState('')
    const [okWithJustLearning, setOkWithJustLearning] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showMyPosts, setShowMyPosts] = useState(false)
    const [connectingPostId, setConnectingPostId] = useState<number | null>(null)
    const [relevanceFilter, setRelevanceFilter] = useState<{ learn: string; teach: string } | null>(null)

    // User search state
    const [searchParams] = useSearchParams()
    const searchQuery = searchParams.get('q') || ''
    const [searchedUsers, setSearchedUsers] = useState<SearchedUser[]>([])
    const [isSearchingUsers, setIsSearchingUsers] = useState(false)

    const { posts, myPosts, isLoading, error, fetchPosts, fetchMyPosts, createPost, markCompleted, clearError } = usePostsStore()
    const { createSession } = useSessionsStore()
    const { user } = useAuthStore()
    const { isUserOnline } = usePresenceStore()
    const navigate = useNavigate()

    useEffect(() => {
        fetchPosts()
        fetchMyPosts()
    }, [fetchPosts, fetchMyPosts])

    // Fetch users when search query changes
    useEffect(() => {
        const fetchUsers = async () => {
            console.log('SearchPage: search query changed:', searchQuery)
            if (!searchQuery.trim()) {
                setSearchedUsers([])
                return
            }
            setIsSearchingUsers(true)
            try {
                const url = `/users/?search=${encodeURIComponent(searchQuery)}`
                console.log('SearchPage: fetching users from:', url)
                const response = await api.get(url)
                console.log('SearchPage: user search response:', response.data)
                setSearchedUsers(response.data)
            } catch (err) {
                console.error("Failed to search users", err)
            } finally {
                setIsSearchingUsers(false)
            }
        }
        fetchUsers()
    }, [searchQuery])

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!topicLearn.trim()) return

        setIsSubmitting(true)
        clearError()
        try {
            await createPost(topicLearn, topicTeach, okWithJustLearning)
            // Set relevance filter to show matching posts
            setRelevanceFilter({ learn: topicLearn.trim(), teach: topicTeach.trim() })
            setShowMyPosts(false)
            setTopicLearn('')
            setTopicTeach('')
            setOkWithJustLearning(false)
            // Refresh posts to get latest
            fetchPosts()
        } catch (err: unknown) {
            const error = err as { response?: { data?: Record<string, string | string[]> } }
            const data = error.response?.data
            if (data) {
                const messages: string[] = []
                for (const val of Object.values(data)) {
                    if (Array.isArray(val)) messages.push(val[0])
                    else if (typeof val === 'string') messages.push(val)
                }
                // Use the store's error or set a custom one
                if (messages.length > 0) {
                    // We need to surface this - use clearError + throw pattern
                }
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleConnect = async (post: LearningPost) => {
        if (!user) return

        setConnectingPostId(post.id)
        try {
            const session = await createSession(post.creator_id, post.id)
            navigate(`/session/${session.id}`)
        } catch (error) {
            console.error('Failed to create session:', error)
        } finally {
            setConnectingPostId(null)
        }
    }

    const handleMarkCompleted = async (id: number) => {
        await markCompleted(id)
    }

    // Check if user can afford to learn (needs credits if learning only)
    const canAffordLearning = user && (user.credits > 0 || !okWithJustLearning)

    // Filter posts
    const displayPosts = showMyPosts
        ? myPosts.filter(p => !p.is_completed)
        : posts.filter(p => {
            // Exclude own posts
            if (p.creator_id === user?.id) return false
            // Bounty filter
            if (okWithJustLearning && !p.ok_with_just_learning) return false

            // Relevance filter (after creating a post)
            if (relevanceFilter) {
                const learn = relevanceFilter.learn.toLowerCase()
                const teach = relevanceFilter.teach.toLowerCase()
                const postLearn = p.topic_to_learn.toLowerCase()
                const postTeach = (p.topic_to_teach || '').toLowerCase()

                // Show posts where their topics overlap with mine
                const teachMatch = teach && (postLearn.includes(teach) || postTeach.includes(teach))
                const learnMatch = learn && (postTeach.includes(learn) || postLearn.includes(learn))
                return teachMatch || learnMatch
            }

            // Search Query Filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase()
                return (
                    p.topic_to_learn.toLowerCase().includes(query) ||
                    (p.topic_to_teach && p.topic_to_teach.toLowerCase().includes(query)) ||
                    p.creator_name.toLowerCase().includes(query)
                )
            }
            return true
        })

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            {/* Search Box - Center Focus */}
            <section className="card" aria-labelledby="search-heading">
                <h2 id="search-heading" className="text-xl font-bold mb-6 text-center">
                    Create a Learning Request
                </h2>

                <form onSubmit={handleSearch} className="space-y-4">
                    <div>
                        <label htmlFor="topic-learn" className="block text-sm font-medium text-slate-300 mb-2">
                            I want to learn...
                        </label>
                        <input
                            id="topic-learn"
                            type="text"
                            value={topicLearn}
                            onChange={(e) => setTopicLearn(e.target.value)}
                            className="input"
                            placeholder="e.g., React, Python, Guitar..."
                            required
                            maxLength={255}
                        />
                    </div>

                    <div>
                        <label htmlFor="topic-teach" className="block text-sm font-medium text-slate-300 mb-2">
                            I can teach...
                        </label>
                        <input
                            id="topic-teach"
                            type="text"
                            value={topicTeach}
                            onChange={(e) => setTopicTeach(e.target.value)}
                            className="input"
                            placeholder="e.g., JavaScript, Design, Piano..."
                            disabled={okWithJustLearning}
                            maxLength={255}
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            id="learning-only"
                            type="checkbox"
                            checked={okWithJustLearning}
                            onChange={(e) => setOkWithJustLearning(e.target.checked)}
                            className="w-5 h-5 rounded border-slate-600 bg-surface text-primary focus:ring-primary"
                        />
                        <label htmlFor="learning-only" className="text-sm text-slate-300">
                            I'm ok with just learning (will cost credits)
                        </label>
                    </div>

                    {okWithJustLearning && user && user.credits <= 0 && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm">
                            ⚠️ You have 0 credits. You won't be able to pay for learning sessions.
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn-primary w-full"
                        disabled={isSubmitting || !topicLearn.trim() || !canAffordLearning}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Creating...
                            </span>
                        ) : (
                            '🔍 Search & Create Post'
                        )}
                    </button>
                </form>
            </section>

            {/* Error Display */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={clearError} className="text-red-400 hover:text-red-300">✕</button>
                </div>
            )}

            {/* User Search Results */}
            {searchQuery && (
                <section aria-labelledby="users-heading">
                    <h2 id="users-heading" className="text-lg font-semibold text-slate-300 mb-4">
                        Users matching "{searchQuery}"
                    </h2>

                    {isSearchingUsers ? (
                        <div className="flex items-center gap-2 text-slate-400">
                            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            Searching users...
                        </div>
                    ) : searchedUsers.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {searchedUsers.map(u => (
                                <Link key={u.id} to={`/user/${u.id}`} className="card hover:border-primary/50 transition-colors flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-lg font-bold">
                                        {u.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-medium text-white">{u.name}</p>
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            {u.average_rating ? (
                                                <span className="text-yellow-400">★ {u.average_rating.toFixed(1)}</span>
                                            ) : (
                                                <span>No ratings</span>
                                            )}
                                            {u.is_online ? (
                                                <span className="text-green-500">• Online</span>
                                            ) : u.availability ? (
                                                <span className="text-slate-500 text-[10px]">• {u.availability}</span>
                                            ) : (
                                                <span className="text-slate-600">• Offline</span>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-500 italic">No users found matching "{searchQuery}"</p>
                    )}
                </section>
            )}

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 p-1 bg-surface-elevated rounded-lg w-fit">
                    <button
                        onClick={() => setShowMyPosts(false)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${!showMyPosts
                            ? 'bg-primary text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-surface'
                            }`}
                    >
                        All Requests
                    </button>
                    <button
                        onClick={() => setShowMyPosts(true)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${showMyPosts
                            ? 'bg-primary text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-surface'
                            }`}
                    >
                        My Posts ({myPosts.filter(p => !p.is_completed).length})
                    </button>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {!showMyPosts && (
                        <button
                            onClick={() => setOkWithJustLearning(!okWithJustLearning)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border flex items-center gap-2 ${okWithJustLearning
                                ? 'bg-green-500/20 text-green-400 border-green-500/50'
                                : 'bg-surface-elevated text-slate-400 border-transparent hover:text-white'
                                }`}
                            title="Show only requests offering credits"
                        >
                            <span>💰</span>
                            <span className="hidden sm:inline">Show only requests offering credits</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Posts Feed */}
            <section aria-labelledby="feed-heading">
                <div className="flex items-center justify-between mb-4">
                    <h2 id="feed-heading" className="text-lg font-semibold text-slate-300">
                        {showMyPosts ? 'My Learning Posts' : relevanceFilter ? `Matching Results for "${relevanceFilter.learn}"` : 'Active Learning Requests'}
                    </h2>
                    <div className="flex items-center gap-3">
                        {relevanceFilter && (
                            <button
                                onClick={() => setRelevanceFilter(null)}
                                className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
                            >
                                ✕ Clear filter
                            </button>
                        )}
                        <button
                            onClick={() => {
                                fetchPosts()
                                fetchMyPosts()
                            }}
                            className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
                            disabled={isLoading}
                        >
                            <span className={isLoading ? 'animate-spin' : ''}>↻</span> Refresh
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="card py-12">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-slate-400">Loading posts...</p>
                        </div>
                    </div>
                ) : displayPosts.length === 0 ? (
                    <div className="card text-center py-12 text-slate-400">
                        <p className="text-xl mb-2">🔍</p>
                        <p>
                            {showMyPosts
                                ? "You haven't created any posts yet."
                                : relevanceFilter
                                    ? "No matching posts found yet. Your post is live — others will see it!"
                                    : "No active requests. Be the first to post!"}
                        </p>
                        {relevanceFilter && (
                            <button
                                onClick={() => setRelevanceFilter(null)}
                                className="mt-3 text-sm text-primary-light hover:underline"
                            >
                                Show all requests
                            </button>
                        )}
                    </div>
                ) : (
                    <ul className="space-y-4">
                        {displayPosts.map((post, index) => (
                            <li
                                key={post.id}
                                className="card hover:border-primary/50 transition-colors animate-slide-up"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Link
                                                to={`/user/${post.creator_id}`}
                                                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold relative">
                                                    {post.creator_name.charAt(0).toUpperCase()}
                                                    <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-surface ${isUserOnline(post.creator_id) ? 'bg-green-500' : 'bg-slate-500'
                                                        }`} />
                                                </div>
                                                <span className="font-medium hover:text-primary-light transition-colors">
                                                    {post.creator_name}
                                                </span>
                                            </Link>
                                            {post.creator_rating !== null && (
                                                <span className="text-yellow-400 text-sm">★ {Number(post.creator_rating).toFixed(1)}</span>
                                            )}
                                        </div>

                                        <p className="text-lg">
                                            Wants to learn <span className="text-primary-light font-semibold">{post.topic_to_learn}</span>
                                        </p>

                                        {post.topic_to_teach && (
                                            <p className="text-slate-400 mt-1">
                                                Can teach: <span className="text-accent">{post.topic_to_teach}</span>
                                            </p>
                                        )}

                                        <div className="flex items-center gap-2 mt-2">
                                            {post.ok_with_just_learning && (
                                                <span className="inline-block px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded">
                                                    Learning only
                                                </span>
                                            )}
                                            {post.bounty_enabled && (
                                                <span className="inline-block px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                                                    💰 Bounty
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-2">
                                        {showMyPosts ? (
                                            <button
                                                onClick={() => handleMarkCompleted(post.id)}
                                                className="btn-secondary text-sm"
                                            >
                                                Mark Done
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleConnect(post)}
                                                disabled={connectingPostId === post.id}
                                                className="btn-primary text-sm"
                                            >
                                                {connectingPostId === post.id ? (
                                                    <span className="flex items-center gap-2">
                                                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        Connecting...
                                                    </span>
                                                ) : (
                                                    'Connect'
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div >
    )
}
