import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function ProtectedRoute() {
    const { isAuthenticated, isHydrated, isLoading } = useAuthStore()

    // Wait for hydration before making any redirect decisions
    if (!isHydrated || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-400">Loading...</p>
                </div>
            </div>
        )
    }

    // Only redirect after hydration is complete
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    return <Outlet />
}
