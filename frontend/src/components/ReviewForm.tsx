import { useState } from 'react'
import { useSessionsStore } from '@/stores/sessionsStore'

interface ReviewFormProps {
    sessionId: number
    onComplete?: () => void
    onSkip?: () => void
}

export default function ReviewForm({ sessionId, onComplete, onSkip }: ReviewFormProps) {
    const [rating, setRating] = useState(0)
    const [hoverRating, setHoverRating] = useState(0)
    const [comment, setComment] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    const { submitReview } = useSessionsStore()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (rating === 0) {
            setError('Please select a rating')
            return
        }

        setIsSubmitting(true)
        setError('')

        try {
            await submitReview(sessionId, { rating, comment })
            setSuccess(true)
            setTimeout(() => {
                onComplete?.()
            }, 1500)
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } } }
            setError(error.response?.data?.detail || 'Failed to submit review')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (success) {
        return (
            <div className="text-center py-4">
                <span className="text-4xl mb-4 block">✅</span>
                <p className="text-lg font-medium">Thank you for your review!</p>
                <p className="text-slate-400 text-sm mt-2">Your feedback helps our community.</p>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Star Rating */}
            <div>
                <p className="text-sm text-slate-400 mb-3 text-center">How was your experience?</p>
                <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="text-3xl transition-transform hover:scale-110"
                            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                        >
                            {star <= (hoverRating || rating) ? '⭐' : '☆'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Comment */}
            <div>
                <label htmlFor="comment" className="block text-sm font-medium text-slate-300 mb-2">
                    Comment (optional)
                </label>
                <textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="input min-h-[80px] resize-none"
                    placeholder="Share your experience..."
                    maxLength={500}
                />
            </div>

            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={onSkip}
                    className="btn-secondary flex-1"
                >
                    Skip
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting || rating === 0}
                    className="btn-primary flex-1"
                >
                    {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Submitting...
                        </span>
                    ) : (
                        'Submit Review'
                    )}
                </button>
            </div>
        </form>
    )
}
