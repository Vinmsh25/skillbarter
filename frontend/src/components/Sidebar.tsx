import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import clsx from 'clsx'

const navItems = [
    { path: '/search', label: 'Search', icon: '🔍', requiresAuth: true },
    { path: '/sessions', label: 'My Sessions', icon: '📚', requiresAuth: true },
    { path: '/profile', label: 'Profile', icon: '👤', requiresAuth: true },
]

export default function Sidebar() {
    const { user, isAuthenticated } = useAuthStore()
    const location = useLocation()

    // Filter items based on authentication
    const visibleNavItems = navItems.filter(item =>
        !item.requiresAuth || isAuthenticated
    )

    const handleRequestSupport = async () => {
        try {
            const response = await api.post('/bank/support/')
            alert(response.data.message)
            // Refresh profile to show new credits
            useAuthStore.getState().fetchProfile()
        } catch (error: any) {
            const message = error.response?.data?.error || 'Failed to request support'
            alert(message)
        }
    }

    return (
        <aside className="fixed left-0 top-0 h-screen w-72 bg-surface/80 backdrop-blur-xl border-r border-white/10 flex flex-col z-50">
            {/* Logo */}
            <div className="p-6 border-b border-white/10">
                <Link to="/" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center transition-transform group-hover:scale-105">
                        <span className="text-xl">📚</span>
                    </div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary-light to-accent bg-clip-text text-transparent">
                        Link & Learn
                    </h1>
                </Link>
            </div>

            {/* Bank Widget - Always Visible */}
            {isAuthenticated && user && (
                <div className="p-6">
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-purple-500 to-accent p-6 text-center shadow-lg shadow-primary/20">
                        {/* Decorative circles */}
                        <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                        <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />

                        <p className="text-sm text-white/80 font-medium uppercase tracking-wider relative z-10">
                            Your Balance
                        </p>
                        <p className="text-4xl font-bold mt-2 mb-1 relative z-10">
                            {Number(user.credits).toFixed(2)}
                        </p>
                        <p className="text-xs text-white/70 uppercase tracking-widest relative z-10">
                            Credits
                        </p>

                        {/* Rate reminder */}
                        <div className="mt-4 pt-4 border-t border-white/20 text-xs text-white/60 relative z-10">
                            5 min teaching = 1 credit
                        </div>
                    </div>

                    {/* Bank Support Link */}
                    <button
                        onClick={handleRequestSupport}
                        className="w-full mt-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                        aria-label="Request bank support"
                    >
                        Need credits? Request support →
                    </button>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6" role="navigation" aria-label="Main navigation">
                <ul className="space-y-2">
                    {visibleNavItems.map((item) => (
                        <li key={item.path}>
                            <Link
                                to={item.path}
                                className={clsx(
                                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                                    location.pathname === item.path
                                        ? 'bg-primary/20 text-primary-light shadow-inner'
                                        : 'text-slate-300 hover:bg-surface-elevated hover:text-white'
                                )}
                                aria-current={location.pathname === item.path ? 'page' : undefined}
                            >
                                <span className="text-xl">{item.icon}</span>
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 text-center text-xs text-slate-500">
                Bank takes 10% cut on earnings
            </div>
        </aside>
    )
}
