// WebRTC Manager - Handles browser-to-server streaming and SFU routing
// For browser-based virtual camera: captures processed media and streams via WebRTC

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  videoCodec?: string;  // 'VP8', 'VP9', 'H264'
  audioCodec?: string;  // 'opus', 'PCMU'
  bitrate?: number;     // Max bitrate in kbps
}

export const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  videoCodec: 'VP8',
  audioCodec: 'opus',
  bitrate: 2500,
};

export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

export interface StreamStats {
  bitrate: number;
  framerate: number;
  packetsLost: number;
  rtt: number;
  resolution: { width: number; height: number };
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private config: WebRTCConfig;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private onStateChange: ((state: ConnectionState) => void) | null = null;
  private onStats: ((stats: StreamStats) => void) | null = null;
  private onRemoteStream: ((stream: MediaStream) => void) | null = null;
  private statsInterval: number | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(config: Partial<WebRTCConfig> = {}) {
    this.config = { ...DEFAULT_WEBRTC_CONFIG, ...config };
  }

  // Create peer connection
  private createPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      iceCandidatePoolSize: 10,
    });

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState as ConnectionState;
      this.onStateChange?.(state);
      
      if (state === 'connected') {
        this.startStatsCollection();
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.stopStatsCollection();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidate?.(event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.onRemoteStream?.(this.remoteStream);
      }
    };

    return pc;
  }

  // Set local stream (from voice changer + background remover)
  setLocalStream(stream: MediaStream): void {
    this.localStream = stream;
    
    if (this.peerConnection) {
      // Replace tracks
      stream.getTracks().forEach(track => {
        const sender = this.peerConnection!.getSenders().find(s => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          this.peerConnection!.addTrack(track, stream);
        }
      });
    }
  }

  // Get remote stream
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // Register callback for remote stream
  setOnRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStream = callback;
    // If we already have a remote stream, call immediately
    if (this.remoteStream) {
      callback(this.remoteStream);
    }
  }

  // Initialize as initiator (browser creates offer)
  async initAsInitiator(): Promise<RTCSessionDescriptionInit> {
    this.peerConnection = this.createPeerConnection();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Set preferred codecs
    this.setPreferredCodecs();

    // Create offer
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    });

    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  // Initialize as receiver (server creates offer)
  async initAsReceiver(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    this.peerConnection = this.createPeerConnection();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    this.setPreferredCodecs();

    await this.peerConnection.setRemoteDescription(offer);
    
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    return answer;
  }

  // Set preferred codecs
  private setPreferredCodecs(): void {
    if (!this.peerConnection) return;

    const transceiver = this.peerConnection.getTransceivers().find(t => t.sender.track?.kind === 'video');
    if (transceiver && this.config.videoCodec) {
      const capabilities = RTCRtpSender.getCapabilities('video');
      if (capabilities) {
        const codec = capabilities.codecs.find(c => c.mimeType.toLowerCase().includes(this.config.videoCodec!.toLowerCase()));
        if (codec) {
          transceiver.setCodecPreferences([codec]);
        }
      }
    }

    const audioTransceiver = this.peerConnection.getTransceivers().find(t => t.sender.track?.kind === 'audio');
    if (audioTransceiver && this.config.audioCodec) {
      const capabilities = RTCRtpSender.getCapabilities('audio');
      if (capabilities) {
        const codec = capabilities.codecs.find(c => c.mimeType.toLowerCase().includes(this.config.audioCodec!.toLowerCase()));
        if (codec) {
          audioTransceiver.setCodecPreferences([codec]);
        }
      }
    }

    // Set bitrate
    if (this.config.bitrate) {
      const videoSender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (videoSender) {
        const parameters = videoSender.getParameters();
        if (!parameters.encodings) parameters.encodings = [{}];
        parameters.encodings[0].maxBitrate = this.config.bitrate * 1000;
        videoSender.setParameters(parameters);
      }
    }
  }

  // Handle remote ICE candidate
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.peerConnection) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  // Process pending candidates after connection created
  private async processPendingCandidates(): Promise<void> {
    for (const candidate of this.pendingCandidates) {
      await this.addIceCandidate(candidate);
    }
    this.pendingCandidates = [];
  }

  // Set remote description (answer for initiator, offer for receiver)
  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(description);
      await this.processPendingCandidates();
    }
  }

  // Get current connection state
  getConnectionState(): ConnectionState {
    return this.peerConnection?.connectionState as ConnectionState || 'new';
  }

  // Register callbacks
  onIceCandidate: ((candidate: RTCIceCandidateInit) => void) | null = null;
  setOnStateChange(callback: (state: ConnectionState) => void): void {
    this.onStateChange = callback;
  }
  setOnStats(callback: (stats: StreamStats) => void): void {
    this.onStats = callback;
  }

  // Start collecting stats
  private startStatsCollection(): void {
    this.stopStatsCollection();
    
    this.statsInterval = window.setInterval(async () => {
      if (!this.peerConnection || this.peerConnection.connectionState !== 'connected') return;

      try {
        const stats = await this.peerConnection.getStats();
        let bitrate = 0;
        let framerate = 0;
        let packetsLost = 0;
        let rtt = 0;
        let width = 0;
        let height = 0;

        stats.forEach(report => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            bitrate = (report.bytesSent || 0) * 8 / 1000; // kbps
            framerate = report.framesPerSecond || 0;
            packetsLost = report.packetsLost || 0;
            width = report.frameWidth || 0;
            height = report.frameHeight || 0;
          }
          if (report.type === 'candidate-pair' && report.nominated) {
            rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0; // ms
          }
        });

        this.onStats?.({ bitrate, framerate, packetsLost, rtt, resolution: { width, height } });
      } catch (error) {
        console.error('Stats collection error:', error);
      }
    }, 1000);
  }

  private stopStatsCollection(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  // Replace video track (e.g., when camera changes)
  async replaceVideoTrack(track: MediaStreamTrack): Promise<void> {
    if (!this.peerConnection) return;
    
    const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(track);
    }
  }

  // Replace audio track
  async replaceAudioTrack(track: MediaStreamTrack): Promise<void> {
    if (!this.peerConnection) return;
    
    const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'audio');
    if (sender) {
      await sender.replaceTrack(track);
    }
  }

  // Mute/unmute tracks
  setAudioEnabled(enabled: boolean): void {
    this.localStream?.getAudioTracks().forEach(t => t.enabled = enabled);
  }

  setVideoEnabled(enabled: boolean): void {
    this.localStream?.getVideoTracks().forEach(t => t.enabled = enabled);
  }

  // Get local stream for preview
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Close connection
  close(): void {
    this.stopStatsCollection();
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    
    this.pendingCandidates = [];
  }
}

// Signaling message types for Socket.io
export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'error';
  payload: any;
  from: string;
  to?: string;
  roomId?: string;
}

export interface JoinRoomMessage {
  type: 'join';
  payload: {
    roomId: string;
    role: 'broadcaster' | 'viewer';
    displayName?: string;
  };
}

export interface OfferMessage {
  type: 'offer';
  payload: RTCSessionDescriptionInit;
}

export interface AnswerMessage {
  type: 'answer';
  payload: RTCSessionDescriptionInit;
}

export interface IceCandidateMessage {
  type: 'ice-candidate';
  payload: RTCIceCandidateInit;
}