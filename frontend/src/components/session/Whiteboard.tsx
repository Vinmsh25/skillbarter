import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import throttle from 'lodash.throttle'
import "@excalidraw/excalidraw/index.css"

// Using 'any' for these types to avoid complex path issues with Excalidraw's internal types
// while ensuring the component logic remains solid.
type ExcalidrawElement = any
type AppState = any

interface WhiteboardProps {
    sessionId: string
    isVisible: boolean
    onSendData: (data: unknown) => void
}

export default function Whiteboard({ sessionId, isVisible, onSendData }: WhiteboardProps) {
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null)
    const isImportingRef = useRef(false)
    const lastSceneRef = useRef<string>('')

    // Load initial state from localStorage
    const getInitialData = () => {
        const saved = localStorage.getItem(`whiteboard_excalidraw_${sessionId}`)
        if (saved) {
            try {
                return JSON.parse(saved)
            } catch (e) {
                console.error('Failed to parse saved whiteboard state', e)
            }
        }
        return null
    }

    const [initialData] = useState(getInitialData)

    // Handle incoming updates from peers
    useEffect(() => {
        const handleWhiteboardEvent = (event: CustomEvent) => {
            if (!excalidrawAPI) return
            const { data } = event.detail

            if (data.type === 'full_state' && data.source !== 'local') {
                isImportingRef.current = true
                excalidrawAPI.updateScene({
                    elements: data.elements,
                    appState: { ...data.appState },
                    commitToHistory: false,
                })
                // Also save to local storage
                localStorage.setItem(`whiteboard_excalidraw_${sessionId}`, JSON.stringify(data))

                // Reset importing flag after a short delay
                setTimeout(() => {
                    isImportingRef.current = false
                }, 100)
            }
        }

        window.addEventListener('whiteboard_update' as any, handleWhiteboardEvent as EventListener)
        return () => window.removeEventListener('whiteboard_update' as any, handleWhiteboardEvent as EventListener)
    }, [excalidrawAPI, sessionId])

    // Throttled broadcast function
    const broadcastChange = useMemo(() =>
        throttle((elements: readonly ExcalidrawElement[], appState: AppState) => {
            if (isImportingRef.current) return

            const sceneData = {
                elements,
                appState: {
                    theme: appState.theme,
                    viewBackgroundColor: appState.viewBackgroundColor
                },
                type: 'full_state'
            }

            // Persist locally
            localStorage.setItem(`whiteboard_excalidraw_${sessionId}`, JSON.stringify(sceneData))

            // Broadcast to peers
            onSendData({
                ...sceneData,
                source: 'local'
            })
        }, 300),
        [onSendData, sessionId])

    // Excalidraw onChange handler
    const onChange = useCallback((elements: readonly ExcalidrawElement[], appState: AppState) => {
        if (isImportingRef.current || !excalidrawAPI) return

        // Quick check for elements change to avoid unnecessary broadcasts
        const sceneString = JSON.stringify(elements.length) // Simple length check first
        if (sceneString === lastSceneRef.current && elements.length > 0) {
            // If length is same, we might still have changes, but let's at least avoid 
            // constant broadcasts for appState changes like pointer movement if possible
            // Excalidraw onChange triggers for many things.
        }
        lastSceneRef.current = sceneString

        broadcastChange(elements, appState)
    }, [excalidrawAPI, broadcastChange])

    if (!isVisible) return null

    return (
        <div className="h-full w-full bg-slate-900 overflow-hidden">
            <Excalidraw
                excalidrawAPI={(api) => setExcalidrawAPI(api)}
                initialData={initialData}
                onChange={onChange}
                theme="dark"
                viewModeEnabled={false}
                zenModeEnabled={false}
                gridModeEnabled={false}
                UIOptions={{
                    canvasActions: {
                        toggleTheme: false,
                        export: false,
                        loadScene: false,
                        saveAsImage: true,
                        clearCanvas: true,
                    },
                }}
            />
        </div>
    )
}
