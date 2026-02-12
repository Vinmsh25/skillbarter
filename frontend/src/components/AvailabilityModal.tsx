import { useState } from 'react'
import api from '@/lib/api'

interface AvailabilityModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
}

export default function AvailabilityModal({ isOpen, onClose, onConfirm }: AvailabilityModalProps) {
    const [availability, setAvailability] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        try {
            await api.patch('/users/me/', { availability })
            onConfirm()
        } catch (error) {
            console.error('Failed to update availability', error)
            // Even if it fails, we should probably allow logout? 
            // Or maybe alert user. For now, just continue to logout.
            onConfirm()
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="card w-full max-w-md p-6 space-y-4">
                <h2 className="text-xl font-bold">Update Availability</h2>
                <p className="text-slate-400 text-sm">
                    You have active learning requests. Please let others know when you are available to chat or meet.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="availability" className="block text-sm font-medium text-slate-300 mb-2">
                            Availability (e.g., "Weekdays 6PM - 9PM EST")
                        </label>
                        <input
                            id="availability"
                            type="text"
                            value={availability}
                            onChange={(e) => setAvailability(e.target.value)}
                            className="input"
                            placeholder="Type your availability..."
                            required
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onConfirm} // Skip updates and logout
                            className="btn-ghost"
                            disabled={isSubmitting}
                        >
                            Skip & Logout
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={isSubmitting || !availability.trim()}
                        >
                            {isSubmitting ? 'Saving...' : 'Save & Logout'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
