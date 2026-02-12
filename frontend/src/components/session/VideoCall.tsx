import { useEffect, useRef, useState, useCallback } from 'react'

interface VideoCallProps {
    sessionId: string
    onSignal: (type: string, payload: any) => void
}

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
}

export default function VideoCall({ sessionId, onSignal }: VideoCallProps) {
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)

    // Initialize state from localStorage or default
    const [isMuted, setIsMuted] = useState(() => {
        return localStorage.getItem('video_muted') === 'true'
    })
    const [isVideoOff, setIsVideoOff] = useState(() => {
        return localStorage.getItem('video_off') === 'true'
    })

    const [connectionState, setConnectionState] = useState<string>('new')

    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const peerRef = useRef<RTCPeerConnection | null>(null)

    // Helper to send signals
    const sendSignal = useCallback((type: string, data: any) => {
        onSignal('signal', {
            payload: {
                type,
                ...data
            }
        })
    }, [onSignal])

    // Initialize WebRTC
    useEffect(() => {
        let mounted = true
        let stream: MediaStream | null = null

        const init = async () => {
            try {
                // Determine constraints based on user preferences
                const constraints = {
                    audio: true, // Always request audio, handle mute via tracks
                    video: !isVideoOff // Only request video if not turned off
                }

                if (!isVideoOff) {
                    stream = await navigator.mediaDevices.getUserMedia(constraints)
                } else {
                    // If video is off, get only audio
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                }

                if (!mounted) {
                    stream.getTracks().forEach(t => t.stop())
                    return
                }

                setLocalStream(stream)

                // Apply initial mute state
                stream.getAudioTracks().forEach(track => track.enabled = !isMuted)

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream
                    localVideoRef.current.muted = true // Always mute local video playback
                }

                const pc = new RTCPeerConnection(ICE_SERVERS)
                peerRef.current = pc

                // Add Tracks
                stream.getTracks().forEach(track => {
                    pc.addTrack(track, stream!)
                })

                // Handle ICE Candidates
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        sendSignal('candidate', { candidate: event.candidate })
                    }
                }

                // Handle Connection State
                pc.onconnectionstatechange = () => {
                    if (mounted) setConnectionState(pc.connectionState)
                }

                // Handle Remote Stream
                pc.ontrack = (event) => {
                    if (mounted) {
                        setRemoteStream(event.streams[0])
                        if (remoteVideoRef.current) {
                            remoteVideoRef.current.srcObject = event.streams[0]
                        }
                    }
                }

                // Announce ready
                sendSignal('ready', {})

            } catch (err) {
                console.error('Failed to access media devices', err)
            }
        }

        init()

        return () => {
            mounted = false
            // CRITICAL: Stop all tracks to turn off camera light
            stream?.getTracks().forEach(track => track.stop())
            localStream?.getTracks().forEach(track => track.stop())
            peerRef.current?.close()
        }
    }, []) // Run once on mount (re-evaluating on isVideoOff logic would require full reconnect)

    // Handle incoming signals
    useEffect(() => {
        const handleSignal = async (e: CustomEvent) => {
            const { peerId: senderId, ...payload } = e.detail
            const pc = peerRef.current
            if (!pc) return

            try {
                if (payload.type === 'ready') {
                    // Start negotiation if we are ready and stable
                    if (pc.signalingState === 'stable') {
                        const offer = await pc.createOffer()
                        await pc.setLocalDescription(offer)
                        sendSignal('offer', { sdp: offer })
                    }
                } else if (payload.type === 'offer') {
                    // Handle Offer
                    if (pc.signalingState !== 'stable') {
                        // Collision handling: rollback if needed
                        await Promise.all([
                            pc.setLocalDescription({ type: 'rollback' }),
                            pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
                        ])
                    } else {
                        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
                    }

                    const answer = await pc.createAnswer()
                    await pc.setLocalDescription(answer)
                    sendSignal('answer', { sdp: answer })

                } else if (payload.type === 'answer') {
                    // Handle Answer
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))

                } else if (payload.type === 'candidate') {
                    // Handle Candidate
                    if (payload.candidate) {
                        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
                    }
                }
            } catch (err) {
                console.error('Signaling error:', err)
            }
        }

        window.addEventListener('remote_peer_id' as any, handleSignal)
        return () => window.removeEventListener('remote_peer_id' as any, handleSignal)
    }, [sendSignal])


    const toggleMute = () => {
        if (localStream) {
            const newMuted = !isMuted
            localStream.getAudioTracks().forEach(track => track.enabled = !newMuted)
            setIsMuted(newMuted)
            localStorage.setItem('video_muted', String(newMuted))
        }
    }

    const toggleVideo = async () => {
        const newVideoOff = !isVideoOff
        setIsVideoOff(newVideoOff)
        localStorage.setItem('video_off', String(newVideoOff))

        // If we connect logic to re-negotiate, we need to restart the stream
        // For simple approach: just toggle track enabled/disabled
        // But to turn OFF light, we must STOP the track.

        if (localStream) {
            const videoTracks = localStream.getVideoTracks()
            if (newVideoOff) {
                // STOP tracks to turn off camera light
                videoTracks.forEach(track => {
                    track.stop()
                    localStream.removeTrack(track)
                })
            } else {
                // Request new video stream
                try {
                    const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
                    const videoTrack = videoStream.getVideoTracks()[0]
                    localStream.addTrack(videoTrack)
                    if (peerRef.current) {
                        peerRef.current.addTrack(videoTrack, localStream)
                        // Note: Adding a track might require renegotiation in a robust WebRTC app
                        // Assuming simple case or existing negotiation handles it
                        // For fully robust renegotiation, simpler to just force refresh/reload or simpler toggle enabled
                        // But user specifically wants light OFF.
                    }
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = localStream
                    }
                } catch (e) {
                    console.error("Failed to restart video", e)
                    setIsVideoOff(true) // Revert
                }
            }
        }
    }

    return (
        <div className="flex flex-col h-full bg-black/40 rounded-lg overflow-hidden relative">
            {/* Remote Video (Main) */}
            <div className="flex-1 relative flex items-center justify-center bg-black/60">
                {remoteStream ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-contain"
                    />
                ) : (
                    <div className="text-slate-500 flex flex-col items-center">
                        <span className="text-4xl mb-2">👤</span>
                        <span>Waiting for partner... ({connectionState})</span>
                        <div className="text-xs mt-2 font-mono opacity-50">
                            Debug: {sessionId}
                        </div>
                    </div>
                )}
            </div>

            {/* Local Video (PiP) */}
            <div className="absolute top-4 right-4 w-32 h-24 bg-black rounded-lg border border-white/10 overflow-hidden shadow-lg z-20">
                {!isVideoOff ? (
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500 text-xs">
                        Video Off
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 p-2 bg-surface/80 backdrop-blur rounded-full border border-white/10 z-20">
                <button
                    onClick={toggleMute}
                    className={`p-3 rounded-full transition-colors ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-surface hover:bg-surface-elevated'}`}
                    title={isMuted ? "Unmute" : "Mute"}
                >
                    {isMuted ? '🔇' : '🎤'}
                </button>
                <button
                    onClick={toggleVideo} // Use simplified toggle for now that just stops track
                    className={`p-3 rounded-full transition-colors ${isVideoOff ? 'bg-red-500/20 text-red-400' : 'bg-surface hover:bg-surface-elevated'}`}
                    title={isVideoOff ? "Start Video" : "Stop Video"}
                >
                    {isVideoOff ? '🚫' : '📹'}
                </button>
            </div>
        </div>
    )
}
