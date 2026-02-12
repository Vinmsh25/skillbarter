import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function HomePage() {
    const { isAuthenticated } = useAuthStore()

    return (
        <div className="animate-fade-in">
            {/* Hero Section */}
            <section className="text-center py-16 lg:py-24">
                <h1 className="text-4xl lg:text-6xl font-bold mb-6">
                    Learn anything.
                    <br />
                    <span className="bg-gradient-to-r from-primary-light via-purple-400 to-accent bg-clip-text text-transparent">
                        Teach something.
                    </span>
                </h1>

                <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
                    A peer-to-peer learning platform where your time creates value.
                    Earn credits by teaching, spend them to learn.
                </p>

                <div className="flex items-center justify-center gap-4">
                    {isAuthenticated ? (
                        <Link to="/search" className="btn-primary text-lg px-8 py-4">
                            Start Learning →
                        </Link>
                    ) : (
                        <>
                            <Link to="/signup" className="btn-primary text-lg px-8 py-4">
                                Get Started Free
                            </Link>
                            <Link to="/login" className="btn-secondary text-lg px-8 py-4">
                                Sign In
                            </Link>
                        </>
                    )}
                </div>
            </section>

            {/* How It Works */}
            <section className="py-16">
                <h2 className="text-2xl font-bold text-center mb-12">How It Works</h2>

                <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                    <div className="card text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-3xl">
                            🎁
                        </div>
                        <h3 className="font-bold mb-2">Start with 15 Credits</h3>
                        <p className="text-slate-400 text-sm">
                            New users receive 15 free credits to begin their learning journey.
                        </p>
                    </div>

                    <div className="card text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center text-3xl">
                            ⏱️
                        </div>
                        <h3 className="font-bold mb-2">5 Minutes = 1 Credit</h3>
                        <p className="text-slate-400 text-sm">
                            Teach for 5 minutes to earn 1 credit. Learning costs the same rate.
                        </p>
                    </div>

                    <div className="card text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center text-3xl">
                            🔄
                        </div>
                        <h3 className="font-bold mb-2">Exchange Knowledge</h3>
                        <p className="text-slate-400 text-sm">
                            Match with peers who want to learn what you know, and vice versa.
                        </p>
                    </div>
                </div>
            </section>

            {/* Stats Bar */}
            <section className="py-12 border-t border-b border-slate-700/50">
                <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto text-center">
                    <div>
                        <p className="text-3xl font-bold text-primary-light">10%</p>
                        <p className="text-slate-400 text-sm">Platform Fee</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-accent">Free</p>
                        <p className="text-slate-400 text-sm">To Join</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-purple-400">∞</p>
                        <p className="text-slate-400 text-sm">Skills to Learn</p>
                    </div>
                </div>
            </section>
        </div>
    )
}
