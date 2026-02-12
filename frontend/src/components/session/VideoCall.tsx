import { useEffect, useRef, useState, useCallback } from 'react'

interface VideoCallProps {
    sessionId: string
    onSignal: (type: string, payload: any) => void
    isConnected: boolean
    isCaller: boolean
}

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
}

export default function VideoCall({ sessionId, onSignal, isConnected, isCaller }: VideoCallProps) {
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)

    // ... (lines 20-33)
    // Initialize state from sessionStorage (scoped to sessionId) or default
    const [isMuted, setIsMuted] = useState(() => {
        const stored = sessionStorage.getItem(`session_media_${sessionId}_muted`)
        return stored !== null ? stored === 'true' : false // Default: Mic ON (isMuted=false)
    })
    const [isVideoOff, setIsVideoOff] = useState(() => {
        const stored = sessionStorage.getItem(`session_media_${sessionId}_video_off`)
        return stored !== null ? stored === 'true' : true // Default: Video OFF (isVideoOff=true)
    })

    const [connectionState, setConnectionState] = useState<string>('new')

    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const peerRef = useRef<RTCPeerConnection | null>(null)

    // Helper to send signals
    const sendSignal = useCallback((type: string, data: any) => {
        if (isConnected) {
            onSignal('signal', {
                payload: {
                    type,
                    ...data
                }
            })
        }
    }, [onSignal, isConnected])

    // Initialize WebRTC
    useEffect(() => {
        if (!isConnected) return

        let mounted = true
        let stream: MediaStream | null = null

        const init = async () => {
            // ... (lines 54-118: logic stays the same) ...
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
                    stream?.getTracks().forEach(t => t.stop())
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
                    console.log('DEBUG: Connection State Change:', pc.connectionState)
                    if (mounted) setConnectionState(pc.connectionState)
                }

                pc.oniceconnectionstatechange = () => {
                    console.log('DEBUG: ICE Connection State Change:', pc.iceConnectionState)
                }

                pc.onicegatheringstatechange = () => {
                    console.log('DEBUG: ICE Gathering State Change:', pc.iceGatheringState)
                }

                // Handle Remote Stream
                pc.ontrack = (event) => {
                    console.log('DEBUG: Track Received', event.streams.length, event.track.kind)
                    if (mounted) {
                        setRemoteStream(event.streams[0])
                        if (remoteVideoRef.current) {
                            console.log('DEBUG: Setting Remote Video srcObject')
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
            stream?.getTracks().forEach(t => t.stop())
            localStream?.getTracks().forEach(t => t.stop())
            peerRef.current?.close()
            peerRef.current = null
        }
    }, [isConnected, isVideoOff]) // Re-run if connection or video preference changes


    // Handle incoming signals
    useEffect(() => {
        const handleSignal = async (e: CustomEvent) => {
            const { peerId: senderId, ...payload } = e.detail
            const pc = peerRef.current

            console.log('DEBUG: VideoCall Signal Received', JSON.stringify({ type: payload.type, isCaller, signalingState: pc?.signalingState }))

            if (!pc) {
                console.warn('DEBUG: RTCPeerConnection not initialized')
                return
            }

            try {
                if (payload.type === 'ready') {
                    // "Ready" means the other peer is online.
                    if (isCaller) {
                        // As Caller, we initiate the offer when we see the other peer is ready.
                        // Check if we are already negotiating to avoid glare or reset
                        if (pc.signalingState === 'stable') {
                            console.log('DEBUG: Caller creating Offer (Auto Reconnect)')

                            // If we already have a remote description, we might need to reset or just re-offer
                            // WebRTC handles renegotiation via createOffer on existing connection
                            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
                            await pc.setLocalDescription(offer)
                            sendSignal('offer', { sdp: offer })
                        }
                    } else {
                        // As Callee, if we receive 'ready', it means the Caller just joined (or re-joined).
                        // We MUST announce ourselves again so the Caller knows WE are ready too.
                        // Even if we think we have a stream, the Caller's 'ready' signal implies a fresh start.
                        if (pc.signalingState === 'stable') {
                            console.log('DEBUG: Callee echoing ready (Auto Reconnect)')
                            // Force send 'ready' to trigger the caller
                            sendSignal('ready', {})
                        }
                    }
                } else if (payload.type === 'offer') {
                    // Handle Offer
                    // If we are Caller and receive offer, it's a glare or role confusion. 
                    // Strict roles: Caller should ideally ignore, but WebRTC requires handling.
                    // However, if Callee behaves correctly, Caller won't receive offer.

                    console.log('DEBUG: Received Offer')
                    if (pc.signalingState !== 'stable') {
                        console.log('DEBUG: Rolling back local description')
                        await pc.setLocalDescription({ type: 'rollback' })
                    }

                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))

                    console.log('DEBUG: Creating Answer')
                    const answer = await pc.createAnswer()
                    await pc.setLocalDescription(answer)
                    sendSignal('answer', { sdp: answer })

                } else if (payload.type === 'answer') {
                    // Handle Answer
                    console.log('DEBUG: Received Answer')
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))

                } else if (payload.type === 'candidate') {
                    // Handle Candidate
                    if (payload.candidate) {
                        console.log('DEBUG: Received ICE Candidate')
                        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
                    }
                }
            } catch (err) {
                console.error('Signaling error:', err)
            }
        }

        window.addEventListener('remote_peer_id' as any, handleSignal)
        return () => window.removeEventListener('remote_peer_id' as any, handleSignal)
    }, [sendSignal, isCaller, remoteStream])


    const toggleMute = () => {
        if (localStream) {
            const newMuted = !isMuted
            localStream.getAudioTracks().forEach(track => track.enabled = !newMuted)
            setIsMuted(newMuted)
            sessionStorage.setItem(`session_media_${sessionId}_muted`, String(newMuted))
        }
    }

    // Sync remote stream to video element when it becomes available
    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            console.log('DEBUG: Syncing Remote Stream to Video Element', remoteStream.id)
            remoteVideoRef.current.srcObject = remoteStream
        }
    }, [remoteStream])

    const toggleVideo = async () => {
        const newVideoOff = !isVideoOff
        setIsVideoOff(newVideoOff)
        sessionStorage.setItem(`session_media_${sessionId}_video_off`, String(newVideoOff))

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
        <div className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">
            {/* Remote Video (Main) */}
            {remoteStream ? (
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                    onLoadedMetadata={() => console.log('DEBUG: Remote Video Metadata Loaded')}
                    onPlay={() => console.log('DEBUG: Remote Video Playing')}
                    onPause={() => console.warn('DEBUG: Remote Video Paused')}
                    onError={(e) => console.error('DEBUG: Remote Video Error', e)}
                />
            ) : (
                <div className="text-slate-500 flex flex-col items-center z-10">
                    <span className="text-4xl mb-2 animate-pulse">👤</span>
                    <span>Waiting for partner... ({connectionState})</span>
                    <div className="text-xs mt-2 font-mono opacity-50">
                        Debug: {sessionId}
                    </div>
                </div>
            )}

            {/* Local Video (PiP) */}
            <div className="absolute top-4 right-4 w-32 h-24 md:w-48 md:h-36 bg-black rounded-lg border border-white/10 overflow-hidden shadow-lg z-20 transition-all hover:scale-105">
                {!isVideoOff ? (
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover mirror-mode"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500 text-xs">
                        Video Off
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 p-3 bg-slate-900/80 backdrop-blur-md rounded-full border border-white/10 z-20 shadow-xl">
                <button
                    onClick={toggleMute}
                    className={`p-4 rounded-full transition-all duration-200 ${isMuted ? 'bg-red-500/90 text-white hover:bg-red-600' : 'bg-slate-700/50 text-white hover:bg-slate-700'}`}
                    title={isMuted ? "Unmute" : "Mute"}
                >
                    {isMuted ? '🔇' : '🎤'}
                </button>
                <button
                    onClick={toggleVideo}
                    className={`p-4 rounded-full transition-all duration-200 ${isVideoOff ? 'bg-red-500/90 text-white hover:bg-red-600' : 'bg-slate-700/50 text-white hover:bg-slate-700'}`}
                    title={isVideoOff ? "Start Video" : "Stop Video"}
                >
                    {isVideoOff ? '🚫' : '📹'}
                </button>
            </div>

            {/* Debug Overlay */}
            <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm p-2 rounded text-[10px] text-white/70 font-mono pointer-events-none z-30">
                <p>Role: {isCaller ? 'Caller' : 'Callee'}</p>
                <p>Status: {connectionState}</p>
                <p>ICE: {peerRef.current?.iceConnectionState || '-'}</p>
            </div>

            <style>{`
                .mirror-mode {
                    transform: scaleX(-1);
                }
            `}</style>
        </div>
    )
}
