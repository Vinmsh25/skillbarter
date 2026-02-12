import { useEffect, useRef } from 'react'

interface JitsiVideoProps {
    sessionId: string
    userName: string
    isVisible: boolean
}

declare global {
    interface Window {
        JitsiMeetExternalAPI: any
    }
}

export default function JitsiVideo({ sessionId, userName, isVisible }: JitsiVideoProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const apiRef = useRef<any>(null)

    useEffect(() => {
        // Load Jitsi External API script
        if (!window.JitsiMeetExternalAPI) {
            const script = document.createElement('script')
            script.src = 'https://meet.jit.si/external_api.js'
            script.async = true
            script.onload = initJitsi
            document.body.appendChild(script)
        } else {
            initJitsi()
        }

        function initJitsi() {
            if (!containerRef.current || apiRef.current) return

            // System Rule: Video off by default
            const options = {
                roomName: `LinkAndLearn_${sessionId}`,
                parentNode: containerRef.current,
                userInfo: {
                    displayName: userName,
                },
                configOverwrite: {
                    startWithAudioMuted: false,
                    startWithVideoMuted: true, // Video OFF by default
                    prejoinPageEnabled: false,
                    disableDeepLinking: true,
                    toolbarButtons: [
                        'microphone',
                        'camera',
                        'desktop',
                        'chat',
                        'raisehand',
                        'tileview',
                        'hangup',
                    ],
                },
                interfaceConfigOverwrite: {
                    TOOLBAR_BUTTONS: [
                        'microphone',
                        'camera',
                        'desktop',
                        'chat',
                        'raisehand',
                        'tileview',
                        'hangup',
                    ],
                    SHOW_JITSI_WATERMARK: false,
                    SHOW_WATERMARK_FOR_GUESTS: false,
                    DEFAULT_BACKGROUND: '#0f172a',
                    DISABLE_VIDEO_BACKGROUND: true,
                },
            }

            try {
                apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', options)

                apiRef.current.on('videoConferenceJoined', () => {
                    console.log('Joined video conference')
                })

                apiRef.current.on('participantLeft', () => {
                    console.log('Participant left')
                })
            } catch (error) {
                console.error('Failed to initialize Jitsi:', error)
            }
        }

        return () => {
            if (apiRef.current) {
                apiRef.current.dispose()
                apiRef.current = null
            }
        }
    }, [sessionId, userName])

    // Handle visibility toggle without destroying instance
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.style.display = isVisible ? 'block' : 'none'
        }
    }, [isVisible])

    return (
        <div
            ref={containerRef}
            className="h-full w-full rounded-lg overflow-hidden"
            style={{ display: isVisible ? 'block' : 'none' }}
        />
    )
}
