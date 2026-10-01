// Voice Changer - Web Audio API implementation for browser
// Provides: pitch shift, formant shift, robot, reverb, noise gate, EQ, compression

export interface VoiceSettings {
  pitch: number;        // 0.5 - 2.0
  formant: number;      // 0.5 - 2.0
  robot: number;        // 0 - 1
  reverb: number;       // 0 - 1
  noiseGate: number;    // -60 - 0 dB
  compression: number;  // 0 - 1
  equalizer: {
    low: number;    // -20 - 20 dB
    mid: number;    // -20 - 20 dB
    high: number;   // -20 - 20 dB
  };
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  pitch: 1.0,
  formant: 1.0,
  robot: 0,
  reverb: 0,
  noiseGate: -40,
  compression: 0,
  equalizer: { low: 0, mid: 0, high: 0 },
};

interface AudioNodeChain {
  input: AudioNode;
  output: AudioNode;
  nodes: AudioNode[];
  cleanup: () => void;
}

export class VoiceChanger {
  private audioContext: AudioContext | null = null;
  private chain: AudioNodeChain | null = null;
  private settings: VoiceSettings = { ...DEFAULT_VOICE_SETTINGS };
  private enabled: boolean = false;

  constructor() {}

  // Initialize audio context (must be called after user gesture)
  async init(): Promise<void> {
    if (this.audioContext) return;
    
    this.audioContext = new AudioContext({ 
      sampleRate: 48000,
      latencyHint: 'interactive'
    });
    
    // Resume if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  // Create the processing chain
  private createChain(source: MediaStreamAudioSourceNode): AudioNodeChain {
    const ctx = this.audioContext!;
    const nodes: AudioNode[] = [];
    
    const cleanup = () => {
      nodes.forEach(n => {
        try { n.disconnect(); } catch {}
      });
    };

    // Input gain
    const inputGain = ctx.createGain();
    inputGain.gain.value = 1;
    nodes.push(inputGain);

    // 1. Noise Gate (Dynamics Compressor as gate)
    const noiseGate = ctx.createDynamicsCompressor();
    noiseGate.threshold.value = this.settings.noiseGate;
    noiseGate.knee.value = 10;
    noiseGate.ratio.value = 20;
    noiseGate.attack.value = 0.001;
    noiseGate.release.value = 0.1;
    nodes.push(noiseGate);

    // 2. EQ Chain
    const eqLow = ctx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 250;
    eqLow.gain.value = this.settings.equalizer.low;
    nodes.push(eqLow);

    const eqMid = ctx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1;
    eqMid.gain.value = this.settings.equalizer.mid;
    nodes.push(eqMid);

    const eqHigh = ctx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 4000;
    eqHigh.gain.value = this.settings.equalizer.high;
    nodes.push(eqHigh);

    let currentNode: AudioNode = inputGain;
    currentNode.connect(noiseGate);
    currentNode = noiseGate;
    currentNode.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    currentNode = eqHigh;

    // 3. Pitch Shift (using delay line + LFO modulation)
    if (this.settings.pitch !== 1.0) {
      const pitchShifter = this.createPitchShifter(ctx, this.settings.pitch);
      currentNode.connect(pitchShifter.input);
      currentNode = pitchShifter.output;
      nodes.push(...pitchShifter.nodes);
    }

    // 4. Formant Shift (allpass filters)
    if (this.settings.formant !== 1.0) {
      const formantShifter = this.createFormantShifter(ctx, this.settings.formant);
      currentNode.connect(formantShifter.input);
      currentNode = formantShifter.output;
      nodes.push(...formantShifter.nodes);
    }

    // 5. Robot Effect (Ring Modulation)
    if (this.settings.robot > 0) {
      const robot = this.createRobotEffect(ctx, this.settings.robot);
      currentNode.connect(robot.input);
      currentNode = robot.output;
      nodes.push(...robot.nodes);
    }

    // 6. Reverb (Convolver with generated impulse)
    if (this.settings.reverb > 0) {
      const reverb = this.createReverb(ctx, this.settings.reverb);
      currentNode.connect(reverb.input);
      currentNode = reverb.output;
      nodes.push(...reverb.nodes);
    }

    // 7. Compression
    if (this.settings.compression > 0) {
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24 - this.settings.compression * 20;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      currentNode.connect(compressor);
      currentNode = compressor;
      nodes.push(compressor);
    }

    // Output gain
    const outputGain = ctx.createGain();
    outputGain.gain.value = 1;
    currentNode.connect(outputGain);
    nodes.push(outputGain);

    // Connect source to chain
    source.connect(inputGain);

    return {
      input: inputGain,
      output: outputGain,
      nodes,
      cleanup,
    };
  }

  // Pitch shifter using delay line with LFO
  private createPitchShifter(ctx: AudioContext, pitch: number): { input: AudioNode; output: AudioNode; nodes: AudioNode[] } {
    const nodes: AudioNode[] = [];
    
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.05;
    nodes.push(delay);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.5; // Slow LFO for pitch variation
    nodes.push(lfo);

    const lfoGain = ctx.createGain();
    // Modulation depth based on pitch shift amount
    lfoGain.gain.value = 0.02 * Math.abs(pitch - 1);
    nodes.push(lfoGain);

    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    lfo.start();

    const inputGain = ctx.createGain();
    const outputGain = ctx.createGain();
    nodes.push(inputGain, outputGain);

    inputGain.connect(delay);
    delay.connect(outputGain);

    return { input: inputGain, output: outputGain, nodes };
  }

  // Formant shifter using cascaded allpass filters
  private createFormantShifter(ctx: AudioContext, formant: number): { input: AudioNode; output: AudioNode; nodes: AudioNode[] } {
    const nodes: AudioNode[] = [];
    const stages = 4;
    
    const inputGain = ctx.createGain();
    const outputGain = ctx.createGain();
    nodes.push(inputGain, outputGain);

    let currentNode: AudioNode = inputGain;

    for (let i = 0; i < stages; i++) {
      const allpass = ctx.createBiquadFilter();
      allpass.type = 'allpass';
      // Frequency scaled by formant factor
      allpass.frequency.value = 1000 * formant * (1 + i * 0.5);
      allpass.Q.value = 1 + i * 0.3;
      nodes.push(allpass);
      
      currentNode.connect(allpass);
      currentNode = allpass;
    }

    currentNode.connect(outputGain);

    return { input: inputGain, output: outputGain, nodes };
  }

  // Robot effect (ring modulation)
  private createRobotEffect(ctx: AudioContext, intensity: number): { input: AudioNode; output: AudioNode; nodes: AudioNode[] } {
    const nodes: AudioNode[] = [];

    const ringMod = ctx.createGain();
    nodes.push(ringMod);

    const ringOsc = ctx.createOscillator();
    ringOsc.type = 'sine';
    ringOsc.frequency.value = 30 + intensity * 200;
    nodes.push(ringOsc);

    const ringGain = ctx.createGain();
    ringGain.gain.value = intensity;
    nodes.push(ringGain);

    ringOsc.connect(ringGain);
    ringGain.connect(ringMod.gain);
    ringOsc.start();

    const inputGain = ctx.createGain();
    const outputGain = ctx.createGain();
    nodes.push(inputGain, outputGain);

    inputGain.connect(ringMod);
    ringMod.connect(outputGain);

    return { input: inputGain, output: outputGain, nodes };
  }

  // Reverb using generated impulse response
  private createReverb(ctx: AudioContext, amount: number): { input: AudioNode; output: AudioNode; nodes: AudioNode[] } {
    const nodes: AudioNode[] = [];

    const convolver = ctx.createConvolver();
    const impulse = this.generateImpulseResponse(ctx, 2, 2 + amount * 3);
    convolver.buffer = impulse;
    convolver.normalize = true;
    nodes.push(convolver);

    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    dryGain.gain.value = 1 - amount * 0.5;
    wetGain.gain.value = amount * 0.5;
    nodes.push(dryGain, wetGain);

    const merge = ctx.createGain();
    nodes.push(merge);

    const inputGain = ctx.createGain();
    const outputGain = ctx.createGain();
    nodes.push(inputGain, outputGain);

    inputGain.connect(dryGain);
    inputGain.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(merge);
    wetGain.connect(merge);
    merge.connect(outputGain);

    return { input: inputGain, output: outputGain, nodes };
  }

  // Generate impulse response for reverb
  private generateImpulseResponse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const n = length - i;
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
      }
    }

    return impulse;
  }

  // Process a media stream
  async processStream(inputStream: MediaStream): Promise<MediaStream> {
    await this.init();
    
    if (!this.enabled) {
      return inputStream;
    }

    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    // Create source from input stream
    const source = this.audioContext.createMediaStreamSource(inputStream);
    
    // Build processing chain
    this.chain = this.createChain(source);

    // Create output destination
    const destination = this.audioContext.createMediaStreamDestination();
    this.chain.output.connect(destination);

    // Create output stream with video from input + processed audio
    const outputStream = new MediaStream();
    inputStream.getVideoTracks().forEach(t => outputStream.addTrack(t));
    destination.stream.getAudioTracks().forEach(t => outputStream.addTrack(t));

    return outputStream;
  }

  // Update settings and rebuild chain if processing
  setSettings(settings: Partial<VoiceSettings>): void {
    this.settings = { ...this.settings, ...settings };
    // Note: Chain rebuild happens on next processStream call
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Cleanup
  destroy(): void {
    if (this.chain) {
      this.chain.cleanup();
      this.chain = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Singleton instance
export const voiceChanger = new VoiceChanger();