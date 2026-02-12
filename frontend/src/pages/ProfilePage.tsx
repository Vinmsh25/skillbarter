import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useSessionsStore } from '@/stores/sessionsStore'
import { usePresenceStore } from '@/stores/presenceStore'
import ReviewCard from '@/components/ReviewCard'
import type { Review } from '@/types'

interface ProfileData {
    id: number
    name: string
    email?: string
    credits?: number
    is_online: boolean
    availability?: string
    average_rating: number | null
    total_reviews: number
    date_joined?: string
}

export default function ProfilePage() {
    const { username } = useParams<{ username?: string }>()
    const { user: currentUser, fetchProfile, isAuthenticated } = useAuthStore()
    const { isUserOnline } = usePresenceStore()
    const [profile, setProfile] = useState<ProfileData | null>(null)
    const [reviews, setReviews] = useState<Review[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // If no username param, show current user's profile
    const isOwnProfile = !username || (currentUser && username === String(currentUser.id))

    // Session creation
    const { createSession } = useSessionsStore()
    const navigate = useNavigate()
    const [isConnecting, setIsConnecting] = useState(false)

    useEffect(() => {
        const loadProfile = async () => {
            setIsLoading(true)
            setErrorMsg(null)
            try {
                if (isOwnProfile) {
                    if (currentUser) {
                        setProfile({
                            id: currentUser.id,
                            name: currentUser.name,
                            email: currentUser.email,
                            credits: currentUser.credits,
                            is_online: currentUser.is_online,
                            availability: currentUser.availability,
                            average_rating: currentUser.average_rating,
                            total_reviews: currentUser.total_reviews,
                            date_joined: currentUser.date_joined,
                        })

                        // Fetch reviews
                        try {
                            const reviewsRes = await api.get(`/users/${currentUser.id}/reviews/`)
                            const reviewsData = Array.isArray(reviewsRes.data)
                                ? reviewsRes.data
                                : (reviewsRes.data?.results ?? [])
                            setReviews(reviewsData)
                        } catch {
                            // Ignore review fetch errors
                        }
                    } else if (isAuthenticated) {
                        try {
                            await fetchProfile()
                        } catch (err) {
                            console.error('Failed to fetch own profile', err)
                            setErrorMsg('Auth error. Please login again.')
                        }
                    }
                } else {
                    // It's another user
                    const userId = username
                    try {
                        const userRes = await api.get(`/users/${userId}/`)
                        const userData = userRes.data

                        setProfile({
                            id: userData.id,
                            name: userData.name,
                            is_online: userData.is_online,
                            availability: userData.availability,
                            average_rating: userData.average_rating,
                            total_reviews: userData.total_reviews,
                        })

                        const reviewsRes = await api.get(`/users/${userId}/reviews/`)
                        const reviewsData = Array.isArray(reviewsRes.data)
                            ? reviewsRes.data
                            : (reviewsRes.data?.results ?? [])
                        setReviews(reviewsData)
                    } catch (err: any) {
                        console.error('Failed to fetch public profile', err)
                        setProfile(null)
                        setErrorMsg(err.response?.data?.detail || 'User not found')
                    }
                }
            } catch (error) {
                console.error('Failed to fetch profile:', error)
            } finally {
                setIsLoading(false)
            }
        }

        loadProfile()
    }, [username, isOwnProfile, fetchProfile, currentUser])

    const handleConnect = async () => {
        if (!profile || !currentUser) return

        setIsConnecting(true)
        try {
            // Create a session with this user
            // Direct Connect (session without learning request)
            const session = await createSession(profile.id)
            navigate(`/session/${session.id}`)
        } catch (error) {
            console.error('Failed to start session:', error)
            alert('Failed to start session. Please try again.')
        } finally {
            setIsConnecting(false)
        }
    }

    // Update profile when currentUser changes (for own profile)
    useEffect(() => {
        if (isOwnProfile && currentUser) {
            setProfile({
                id: currentUser.id,
                name: currentUser.name,
                email: currentUser.email,
                credits: currentUser.credits,
                is_online: currentUser.is_online,
                availability: currentUser.availability,
                average_rating: currentUser.average_rating,
                total_reviews: currentUser.total_reviews,
                date_joined: currentUser.date_joined,
            })
        }
    }, [currentUser, isOwnProfile])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400">Loading profile...</p>
                </div>
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="text-center py-12">
                <p className="text-xl text-slate-400">{errorMsg || 'User not found'}</p>
                <Link to="/search" className="text-primary-light hover:underline mt-4 inline-block">
                    ← Back to Search
                </Link>
            </div>
        )
    }

    const avgRating = profile.average_rating ?? 0

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            {/* Profile Header */}
            <div className="card">
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-4xl font-bold relative">
                        {profile.name.charAt(0).toUpperCase()}
                        <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-surface ${isUserOnline(profile.id) ? 'bg-green-500' : 'bg-slate-500'
                            }`} />
                    </div>

                    <div className="flex-1">
                        <h1 className="text-2xl font-bold">{profile.name}</h1>
                        {isOwnProfile && profile.email && (
                            <p className="text-slate-400 text-sm">{profile.email}</p>
                        )}

                        {/* Rating Badge */}
                        <div className="flex items-center gap-3 mt-2">
                            <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <span
                                        key={star}
                                        className={`text-xl ${star <= Math.round(avgRating) ? 'text-yellow-400' : 'text-slate-600'}`}
                                    >
                                        ★
                                    </span>
                                ))}
                            </div>
                            <span className="text-lg font-semibold">{avgRating.toFixed(1)}</span>
                            <span className="text-slate-400 text-sm">
                                ({profile.total_reviews} review{profile.total_reviews !== 1 ? 's' : ''})
                            </span>
                        </div>
                    </div>

                    {/* Credits (only for own profile) */}
                    {isOwnProfile && profile.credits !== undefined && (
                        <div className="text-right">
                            <p className="text-3xl font-bold text-primary-light">{Number(profile.credits).toFixed(2)}</p>
                            <p className="text-slate-400 text-sm">Credits</p>
                        </div>
                    )}

                    {/* Actions for other users */}
                    {!isOwnProfile && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleConnect}
                                disabled={isConnecting}
                                className="btn-primary"
                            >
                                {isConnecting ? 'Starting...' : 'Start Session & Chat'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
                <div className="card text-center py-6">
                    <p className="text-3xl font-bold text-primary-light">{avgRating.toFixed(1)}</p>
                    <p className="text-slate-400 text-sm mt-1">Avg Rating</p>
                </div>
                <div className="card text-center py-6">
                    <p className="text-3xl font-bold text-accent">{profile.total_reviews}</p>
                    <p className="text-slate-400 text-sm mt-1">Reviews</p>
                </div>
                <div className="card text-center py-6">
                    <p className="text-3xl font-bold text-purple-400">
                        {isUserOnline(profile.id) ? '🟢' : '⚫'}
                    </p>
                    <p className="text-slate-400 text-sm mt-1">
                        {isUserOnline(profile.id) ? 'Online' : 'Offline'}
                    </p>
                    {!isUserOnline(profile.id) && (
                        <p className="text-xs text-primary-light mt-2 border-t border-white/10 pt-2">
                            {profile.availability ? `Expected: ${profile.availability}` : 'No availability provided'}
                        </p>
                    )}
                </div>
            </div>

            {/* Reviews Section */}
            <section>
                <h2 className="text-lg font-semibold mb-4 text-slate-300">Reviews</h2>

                {reviews.length === 0 ? (
                    <div className="card text-center py-8 text-slate-400">
                        No reviews yet
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((review) => (
                            <ReviewCard
                                key={review.id}
                                reviewerId={typeof review.reviewer === 'object' ? review.reviewer.id : review.reviewer}
                                reviewerName={review.reviewer_name}
                                rating={review.rating}
                                comment={review.comment}
                                createdAt={review.created_at}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* Profile Menu (only for own profile) */}
            {isOwnProfile && (
                <nav className="card divide-y divide-slate-700" role="navigation" aria-label="Profile menu">
                    <Link to="/sessions" className="flex items-center gap-4 py-4 hover:text-primary-light transition-colors">
                        <span className="text-xl">📚</span>
                        <span>My Sessions</span>
                    </Link>
                    <Link to="/search" className="flex items-center gap-4 py-4 hover:text-primary-light transition-colors">
                        <span className="text-xl">🔍</span>
                        <span>Find Sessions</span>
                    </Link>
                </nav>
            )}
        </div>
    )
}
