import { Link } from 'react-router-dom'

interface ReviewCardProps {
    reviewerId: number
    reviewerName: string
    rating: number
    comment: string
    createdAt: string
}

export default function ReviewCard({ reviewerId, reviewerName, rating, comment, createdAt }: ReviewCardProps) {
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
    }

    return (
        <div className="card p-4">
            <div className="flex items-start justify-between mb-3">
                <Link to={`/user/${reviewerId}`} className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold transition-transform group-hover:scale-105">
                        {reviewerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-medium group-hover:text-primary-light transition-colors">{reviewerName}</p>
                        <p className="text-xs text-slate-400">{formatDate(createdAt)}</p>
                    </div>
                </Link>

                <div className="flex gap-0.5 text-lg">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className={star <= rating ? 'text-yellow-400' : 'text-slate-600'}>
                            ★
                        </span>
                    ))}
                </div>
            </div>

            {comment && (
                <p className="text-slate-300 text-sm">{comment}</p>
            )}
        </div>
    )
}
