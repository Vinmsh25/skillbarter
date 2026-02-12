import { create } from 'zustand'
import type { UserPublic } from '@/types'

interface PresenceState {
    onlineUsers: UserPublic[]
    requestStatus: Map<number, 'online' | 'offline'> // Fast lookup

    // Actions
    setOnlineUsers: (users: UserPublic[]) => void
    addUser: (user: UserPublic) => void
    removeUser: (userId: number) => void
    isUserOnline: (userId: number) => boolean
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
    onlineUsers: [],
    requestStatus: new Map(),

    setOnlineUsers: (users) => {
        const map = new Map<number, 'online' | 'offline'>()
        users.forEach(u => map.set(u.id, 'online'))
        set({ onlineUsers: users, requestStatus: map })
    },

    addUser: (user) => {
        set(state => {
            const exists = state.onlineUsers.some(u => u.id === user.id)
            if (exists) return state

            const newMap = new Map(state.requestStatus)
            newMap.set(user.id, 'online')

            return {
                onlineUsers: [...state.onlineUsers, user],
                requestStatus: newMap
            }
        })
    },

    removeUser: (userId) => {
        set(state => {
            const newMap = new Map(state.requestStatus)
            newMap.delete(userId)

            return {
                onlineUsers: state.onlineUsers.filter(u => u.id !== userId),
                requestStatus: newMap
            }
        })
    },

    isUserOnline: (userId) => {
        return get().requestStatus.has(userId)
    }
}))
