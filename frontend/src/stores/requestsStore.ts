import { create } from 'zustand'
import api from '@/lib/api'
import type { LearningPost } from '@/types'

interface PostsState {
    posts: LearningPost[]
    myPosts: LearningPost[]
    isLoading: boolean
    error: string | null

    // Actions
    fetchPosts: () => Promise<void>
    fetchMyPosts: () => Promise<void>
    createPost: (topicLearn: string, topicTeach: string, okWithJustLearning: boolean) => Promise<LearningPost>
    markCompleted: (id: number) => Promise<void>
    deletePost: (id: number) => Promise<void>
    clearError: () => void
}

export const usePostsStore = create<PostsState>((set) => ({
    posts: [],
    myPosts: [],
    isLoading: false,
    error: null,

    fetchPosts: async () => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get('/posts/')
            // Handle paginated response (Django REST returns { results: [...] })
            const posts = Array.isArray(response.data)
                ? response.data
                : (response.data?.results ?? [])
            set({ posts, isLoading: false })
        } catch (error) {
            set({ error: 'Failed to load posts', isLoading: false })
        }
    },

    fetchMyPosts: async () => {
        set({ isLoading: true, error: null })
        try {
            const response = await api.get('/posts/my_posts/')
            // Handle paginated response (Django REST returns { results: [...] })
            const myPosts = Array.isArray(response.data)
                ? response.data
                : (response.data?.results ?? [])
            set({ myPosts, isLoading: false })
        } catch (error) {
            set({ error: 'Failed to load your posts', isLoading: false })
        }
    },

    createPost: async (topicLearn: string, topicTeach: string, okWithJustLearning: boolean) => {
        set({ error: null })
        try {
            const response = await api.post('/posts/', {
                topic_to_learn: topicLearn,
                topic_to_teach: topicTeach || '',
                ok_with_just_learning: okWithJustLearning,
            })

            const newPost = response.data

            // Add to local state
            set((state) => ({
                posts: [newPost, ...state.posts],
                myPosts: [newPost, ...state.myPosts],
            }))

            return newPost
        } catch (error: unknown) {
            const err = error as { response?: { data?: Record<string, unknown> } }
            const data = err.response?.data
            let message = 'Failed to create post'
            if (data) {
                if (typeof data.detail === 'string') {
                    message = data.detail
                } else if (Array.isArray(data.non_field_errors)) {
                    message = data.non_field_errors[0]
                } else {
                    // Field-level errors
                    const firstVal = Object.values(data)[0]
                    if (Array.isArray(firstVal)) message = firstVal[0]
                    else if (typeof firstVal === 'string') message = firstVal
                }
            }
            set({ error: message })
            throw error
        }
    },

    markCompleted: async (id: number) => {
        try {
            await api.patch(`/posts/${id}/complete/`)

            // Update local state
            set((state) => ({
                posts: state.posts.filter((p) => p.id !== id),
                myPosts: state.myPosts.map((p) =>
                    p.id === id ? { ...p, is_completed: true } : p
                ),
            }))
        } catch (error) {
            set({ error: 'Failed to mark post as completed' })
        }
    },

    deletePost: async (id: number) => {
        try {
            await api.delete(`/posts/${id}/`)
            set((state) => ({
                posts: state.posts.filter((p) => p.id !== id),
                myPosts: state.myPosts.filter((p) => p.id !== id),
            }))
        } catch (error) {
            set({ error: 'Failed to delete post' })
        }
    },

    clearError: () => set({ error: null }),
}))

// Keep backwards compatibility alias
export const useRequestsStore = usePostsStore
