/**
 * Shared TypeScript types matching backend API responses
 */

// ============ User Types ============

export interface User {
    id: number
    email: string
    name: string
    credits: number
    is_online: boolean
    availability?: string
    date_joined: string
    average_rating: number | null
    total_reviews: number
}

export interface UserPublic {
    id: number
    name: string
    is_online: boolean
    average_rating: number | null
    total_reviews: number
}

// ============ Learning Post Types ============

export interface LearningPost {
    id: number
    creator_id: number
    creator_name: string
    creator_rating: number | null
    topic_to_learn: string
    topic_to_teach: string
    ok_with_just_learning: boolean
    bounty_enabled: boolean
    created_at: string
    is_completed: boolean
}

export interface LearningPostCreate {
    topic_to_learn: string
    topic_to_teach?: string
    ok_with_just_learning?: boolean
    bounty_enabled?: boolean
}

// ============ Session Types ============

export interface SessionTimer {
    id: number
    teacher: number
    teacher_name: string
    start_time: string
    end_time: string | null
    duration_seconds: number | null
    is_running: boolean
}

export interface Session {
    id: number
    user1: number
    user1_name: string
    user2: number
    user2_name: string
    learning_request: number | null
    start_time: string
    end_time: string | null
    is_active: boolean
    total_duration: number
    user1_teaching_time: number
    user2_teaching_time: number
    active_timer: SessionTimer | null
}

export interface SessionCreate {
    user2: number
    learning_request?: number | null
}

// ============ Review Types ============

export interface Review {
    id: number
    reviewer: number | UserPublic
    reviewer_name: string
    reviewee: number | UserPublic
    reviewee_name: string
    session: number
    rating: number
    comment: string
    created_at: string
}

export interface ReviewCreate {
    rating: number
    comment: string
}

// ============ Credit Types ============

export interface CreditTransaction {
    id: number
    amount: number
    transaction_type: 'SIGNUP' | 'TEACHING' | 'LEARNING' | 'SUPPORT' | 'BOUNTY'
    balance_after: number
    description: string
    created_at: string
}

// ============ Auth Types ============

export interface LoginCredentials {
    email: string
    password: string
}

export interface SignupCredentials {
    email: string
    name: string
    password: string
    password_confirm: string
}

export interface AuthTokens {
    access: string
    refresh: string
}

// ============ WebSocket Event Types ============

export interface WSPresenceUpdate {
    type: 'presence_update'
    user: UserPublic
    status: 'online' | 'offline'
}

export interface WSOnlineUsers {
    type: 'online_users'
    users: UserPublic[]
}

export interface WSChatMessage {
    type: 'chat_message'
    sender: string
    message: string
    timestamp?: string
}

export interface WSTimerStarted {
    type: 'timer_started'
    teacher_id: number
    teacher_name: string
    start_time: string
    timer_id: number
}

export interface WSTimerStopped {
    type: 'timer_stopped'
    teacher_id: number
    teacher_name: string
    end_time: string
    duration_seconds: number
    timer_id: number
}

export interface WSSessionEnded {
    type: 'session_ended'
    ended_by: number
    credit_summary: {
        user1: { earned: number; spent: number }
        user2: { earned: number; spent: number }
        bank_cut: number
    }
    your_credits: number
}

export interface WSCreditUpdate {
    type: 'credit_update'
    user_id: number
    new_balance: number
}

export interface WSSessionState {
    type: 'session_state'
    session: Session
}
