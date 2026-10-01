import { useRef, useCallback, useEffect } from 'react'

export function useVoiceProcessor() {
  const audioContextRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const processorRef = useRef({
    pitchShifter: null,
    formantShifter: null,
    ringModulator: null,
    convolver: null,
    noiseGate: null,
    compressor: null,
    eqLow: null,
    eqMid: null,
    eqHigh: null,
    gain: null,
  })
  const outputStreamRef = useRef(null)
  const mediaStreamDestinationRef = useRef(null)
  const animationRef = useRef(null)

  // Initialize audio context
  const ensureAudioContext = useCallback(async () => {
    if (audioContextRef.current) return audioContextRef.current

    const AudioContext = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioContext({ sampleRate: 48000 })
    audioContextRef.current = ctx

    // Create processing chain
    const gain = ctx.createGain()
    gain.gain.value = 1

    // Pitch shifter (using delay line modulation)
    const pitchShifter = ctx.createDelay(1.0)
    pitchShifter.delayTime.value = 0.05

    // Formant shifter (using multiple delay lines)
    const formantShifter = ctx.createDelay(1.0)
    formantShifter.delayTime.value = 0.05

    // Ring modulator for robot effect
    const ringModulator = ctx.createGain()

    // Reverb convolver
    const convolver = ctx.createConvolver()

    // Noise gate
    const noiseGate = ctx.createDynamicsCompressor()
    noiseGate.threshold.value = -40
    noiseGate.knee.value = 10
    noiseGate.ratio.value = 20
    noiseGate.attack.value = 0.001
    noiseGate.release.value = 0.1

    // Compressor
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -24
    compressor.knee.value = 30
    compressor.ratio.value = 12
    compressor.attack.value = 0.003
    compressor.release.value = 0.25

    // Equalizer (3-band)
    const eqLow = ctx.createBiquadFilter()
    eqLow.type = 'lowshelf'
    eqLow.frequency.value = 250
    eqLow.gain.value = 0

    const eqMid = ctx.createBiquadFilter()
    eqMid.type = 'peaking'
    eqMid.frequency.value = 1000
    eqMid.Q.value = 1
    eqMid.gain.value = 0

    const eqHigh = ctx.createBiquadFilter()
    eqHigh.type = 'highshelf'
    eqHigh.frequency.value = 4000
    eqHigh.gain.value = 0

    // Media stream destination for output
    const mediaStreamDestination = ctx.createMediaStreamDestination()
    mediaStreamDestinationRef.current = mediaStreamDestination

    // Connect chain: source -> processing -> destination
    // We'll connect dynamically based on enabled effects

    processorRef.current = {
      pitchShifter,
      formantShifter,
      ringModulator,
      convolver,
      noiseGate,
      compressor,
      eqLow,
      eqMid,
      eqHigh,
      gain,
      mediaStreamDestination,
    }

    // Resume context if suspended
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    return ctx
  }, [])

  // Generate impulse response for reverb
  const generateImpulseResponse = useCallback((duration = 2, decay = 2) => {
    const ctx = audioContextRef.current
    if (!ctx) return null

    const sampleRate = ctx.sampleRate
    const length = sampleRate * duration
    const impulse = ctx.createBuffer(2, length, sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const n = length - i
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay)
      }
    }

    return impulse
  }, [])

  // Pitch shifting using delay line with modulated delay time
  const createPitchShifter = useCallback((pitchRatio) => {
    const ctx = audioContextRef.current
    if (!ctx) return null

    const shifter = ctx.createDelay(1.0)
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()

    lfo.type = 'sine'
    lfo.frequency.value = 0.5 // Modulation rate
    lfoGain.gain.value = 0.01 * (pitchRatio - 1) // Modulation depth

    lfo.connect(lfoGain)
    lfoGain.connect(shifter.delayTime)
    lfo.start()

    return { node: shifter, lfo, lfoGain }
  }, [])

  // Formant shifting using frequency warping approximation
  const createFormantShifter = useCallback((formantRatio) => {
    const ctx = audioContextRef.current
    if (!ctx) return null

    // Use a chain of allpass filters for formant shifting approximation
    const filters = []
    for (let i = 0; i < 4; i++) {
      const filter = ctx.createBiquadFilter()
      filter.type = 'allpass'
      filter.frequency.value = 500 * Math.pow(formantRatio, i * 0.5)
      filter.Q.value = 1
      filters.push(filter)
    }

    // Connect in series
    for (let i = 0; i < filters.length - 1; i++) {
      filters[i].connect(filters[i + 1])
    }

    return { input: filters[0], output: filters[filters.length - 1] }
  }, [])

  // Main processing function
  const processAudio = useCallback(async (inputStream, settings) => {
    const ctx = await ensureAudioContext()

    // Clean up previous connections
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect()
    }

    // Create source from input stream
    const source = ctx.createMediaStreamSource(inputStream)
    sourceNodeRef.current = source

    const {
      pitch,
      formant,
      robot,
      reverb,
      noiseGate,
      compression,
      equalizer,
    } = settings

    const p = processorRef.current

    // Build processing chain dynamically
    let currentNode = source

    // Noise gate first
    if (noiseGate < 0) {
      p.noiseGate.threshold.value = noiseGate
      currentNode.connect(p.noiseGate)
      currentNode = p.noiseGate
    }

    // Equalizer
    p.eqLow.gain.value = equalizer.low
    p.eqMid.gain.value = equalizer.mid
    p.eqHigh.gain.value = equalizer.high

    currentNode.connect(p.eqLow)
    p.eqLow.connect(p.eqMid)
    p.eqMid.connect(p.eqHigh)
    currentNode = p.eqHigh

    // Pitch shifting
    if (pitch !== 1.0) {
      const pitchNode = createPitchShifter(pitch)
      currentNode.connect(pitchNode.node)
      currentNode = pitchNode.node
      // Store for cleanup
      if (p.pitchShifterLFO) {
        p.pitchShifterLFO.stop()
        p.pitchShifterLFO.disconnect()
      }
      p.pitchShifterLFO = pitchNode.lfo
      p.pitchShifterGain = pitchNode.lfoGain
    }

    // Formant shifting
    if (formant !== 1.0) {
      const formantNode = createFormantShifter(formant)
      currentNode.connect(formantNode.input)
      currentNode = formantNode.output
    }

    // Robot effect (ring modulation)
    if (robot > 0) {
      const ringFreq = 30 + robot * 200 // 30-230 Hz
      const ringOsc = ctx.createOscillator()
      const ringGain = ctx.createGain()

      ringOsc.type = 'sine'
      ringOsc.frequency.value = ringFreq
      ringGain.gain.value = robot

      currentNode.connect(p.ringModulator)
      ringOsc.connect(ringGain)
      ringGain.connect(p.ringModulator.gain)
      ringOsc.start()

      currentNode = p.ringModulator

      // Store for cleanup
      if (p.robotOsc) {
        p.robotOsc.stop()
        p.robotOsc.disconnect()
      }
      p.robotOsc = ringOsc
      p.robotGain = ringGain
    }

    // Reverb
    if (reverb > 0) {
      const impulse = generateImpulseResponse(2, 2 + reverb * 3)
      if (impulse) {
        p.convolver.buffer = impulse
        p.convolver.normalize = true
      }

      const dryGain = ctx.createGain()
      const wetGain = ctx.createGain()
      dryGain.gain.value = 1 - reverb * 0.5
      wetGain.gain.value = reverb * 0.5

      currentNode.connect(dryGain)
      currentNode.connect(p.convolver)
      p.convolver.connect(wetGain)

      const reverbMerge = ctx.createGain()
      dryGain.connect(reverbMerge)
      wetGain.connect(reverbMerge)

      currentNode = reverbMerge
    }

    // Compression
    if (compression > 0) {
      p.compressor.threshold.value = -24 - compression * 20
      currentNode.connect(p.compressor)
      currentNode = p.compressor
    }

    // Final gain
    currentNode.connect(p.gain)
    p.gain.connect(p.mediaStreamDestination)

    outputStreamRef.current = p.mediaStreamDestination.stream
    return outputStreamRef.current
  }, [ensureAudioContext, createPitchShifter, createFormantShifter, generateImpulseResponse])

  const cleanup = useCallback(() => {
    // Stop oscillators
    if (processorRef.current.pitchShifterLFO) {
      processorRef.current.pitchShifterLFO.stop()
      processorRef.current.pitchShifterLFO.disconnect()
    }
    if (processorRef.current.robotOsc) {
      processorRef.current.robotOsc.stop()
      processorRef.current.robotOsc.disconnect()
    }
    if (processorRef.current.robotGain) {
      processorRef.current.robotGain.disconnect()
    }

    // Disconnect source
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    outputStreamRef.current = null
  }, [])

  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  return { processAudio, cleanup }
}