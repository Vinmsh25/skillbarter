import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { usePostsStore } from '@/stores/requestsStore'
import { useState, useEffect } from 'react'
import AvailabilityModal from './AvailabilityModal'

export default function Header() {
    const { user, isAuthenticated, logout } = useAuthStore()
    const { myPosts } = usePostsStore()
    const [showAvailabilityModal, setShowAvailabilityModal] = useState(false)
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [searchValue, setSearchValue] = useState('')

    // Sync search input with URL
    useEffect(() => {
        setSearchValue(searchParams.get('q') || '')
    }, [searchParams])

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setSearchValue(value)
        if (value.trim()) {
            navigate(`/search?q=${encodeURIComponent(value)}`)
        } else {
            navigate('/search')
        }
    }

    const handleLogoutClick = () => {
        // Check if user has active posts
        const hasActivePosts = myPosts.some(p => !p.is_completed)

        if (hasActivePosts) {
            setShowAvailabilityModal(true)
        } else {
            logout()
        }
    }

    return (
        <>
            <header className="h-16 bg-surface/50 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-6 lg:px-8 sticky top-0 z-40">
                {/* Logo */}
                <div className="flex items-center gap-4">
                    <Link to="/" className="flex items-center gap-2">
                        <span className="text-2xl">🔗</span>
                        <span className="font-bold text-lg bg-gradient-to-r from-primary-light to-accent bg-clip-text text-transparent hidden sm:block">
                            Link & Learn
                        </span>
                    </Link>

                    {isAuthenticated && (
                        <div className="relative ml-8">
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchValue}
                                className="bg-surface-elevated/50 border border-white/10 rounded-full py-1.5 px-4 pl-9 text-sm w-48 focus:w-64 transition-all focus:bg-surface-elevated focus:border-primary/50 outline-none"
                                onChange={handleSearch}
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                        </div>
                    )}
                </div>

                {/* User Actions */}
                <nav className="flex items-center gap-4" role="navigation" aria-label="User menu">
                    {isAuthenticated ? (
                        <>
                            {/* Credits Display */}
                            {user && (
                                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface-elevated rounded-lg">
                                    <span className="text-yellow-400">💰</span>
                                    <span className="font-medium text-primary-light">{Number(user.credits).toFixed(2)}</span>
                                    <span className="text-slate-400 text-sm">credits</span>
                                </div>
                            )}

                            <Link to="/profile" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold">
                                    {user?.name?.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-slate-300 hidden sm:block">
                                    {user?.name}
                                </span>
                            </Link>


                            <button
                                onClick={handleLogoutClick}
                                className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-surface-elevated rounded-lg transition-colors"
                                aria-label="Logout"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link
                                to="/login"
                                className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
                            >
                                Login
                            </Link>
                            <Link
                                to="/signup"
                                className="btn-primary text-sm"
                            >
                                Sign Up
                            </Link>
                        </>
                    )}
                </nav>
            </header>

            <AvailabilityModal
                isOpen={showAvailabilityModal}
                onClose={() => setShowAvailabilityModal(false)}
                onConfirm={() => {
                    setShowAvailabilityModal(false)
                    logout()
                }}
            />
        </>
    )
}
