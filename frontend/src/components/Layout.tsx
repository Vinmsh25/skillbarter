import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { usePresence } from '@/hooks/usePresence'

export default function Layout() {
    // Connect to presence WebSocket to mark user as online
    usePresence()
    const location = useLocation()
    const isSessionPage = location.pathname.startsWith('/session/')

    return (
        <div className="flex min-h-screen bg-surface-dark">
            {/* Always-visible Bank Sidebar (unless in session) */}
            {!isSessionPage && <Sidebar />}

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col ${isSessionPage ? '' : 'ml-72'}`}>
                <Header />
                <main className="flex-1 p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
