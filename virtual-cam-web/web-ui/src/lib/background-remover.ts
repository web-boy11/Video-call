// Background Removal - MediaPipe Selfie Segmentation in browser
// Handles: blur, image replacement, color replacement, virtual background

export type BackgroundMode = 'none' | 'blur' | 'image' | 'color';

export interface BackgroundSettings {
  enabled: boolean;
  mode: BackgroundMode;
  backgroundImage: string | null;     // Data URL or URL for image mode
  backgroundColor: string;            // CSS color for color mode
  blurAmount: number;                 // 0-50px for blur mode
  segmentationThreshold: number;      // 0-1, higher = more aggressive foreground
  mirrorPreview: boolean;
}

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  enabled: false,
  mode: 'blur',
  backgroundImage: null,
  backgroundColor: '#000000',
  blurAmount: 15,
  segmentationThreshold: 0.5,
  mirrorPreview: true,
};

declare global {
  interface Window {
    SelfieSegmentation: any;
  }
}

export class BackgroundRemover {
  private selfieSegmentation: any = null;
  private initialized: boolean = false;
  private settings: BackgroundSettings = { ...DEFAULT_BACKGROUND_SETTINGS };
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private backgroundCanvas: HTMLCanvasElement | null = null;
  private backgroundContext: CanvasRenderingContext2D | null = null;
  private backgroundImage: HTMLImageElement | null = null;
  private animationFrameId: number | null = null;
  private onFrameCallback: ((canvas: HTMLCanvasElement) => void) | null = null;
  private videoElement: HTMLVideoElement | null = null;

  constructor() {}

  // Initialize MediaPipe Selfie Segmentation
  async init(): Promise<void> {
    if (this.initialized) return;

    // Load MediaPipe from CDN
    await this.loadMediaPipe();
    
    // Create segmentation instance
    this.selfieSegmentation = new window.SelfieSegmentation({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
      },
    });

    this.selfieSegmentation.setOptions({
      modelSelection: 1, // 0 = general, 1 = landscape (better for full body)
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    // Create offscreen canvases
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d', { willReadFrequently: true, alpha: true })!;
    
    this.backgroundCanvas = document.createElement('canvas');
    this.backgroundContext = this.backgroundCanvas.getContext('2d', { alpha: true })!;

    this.initialized = true;
  }

  // Load MediaPipe script dynamically
  private loadMediaPipe(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.SelfieSegmentation) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.4.1646425789/selfie_segmentation.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load MediaPipe Selfie Segmentation'));
      document.head.appendChild(script);
    });
  }

  // Set video element to process
  setVideoElement(video: HTMLVideoElement): void {
    this.videoElement = video;
    
    // Resize canvas to match video
    const resize = () => {
      if (!this.canvas || !this.backgroundCanvas || !this.videoElement) return;
      this.canvas.width = this.videoElement.videoWidth;
      this.canvas.height = this.videoElement.videoHeight;
      this.backgroundCanvas.width = this.videoElement.videoWidth;
      this.backgroundCanvas.height = this.videoElement.videoHeight;
    };
    
    video.addEventListener('loadeddata', resize);
    video.addEventListener('resize', resize);
    
    if (video.videoWidth > 0) {
      resize();
    }
  }

  // Update settings
  setSettings(settings: Partial<BackgroundSettings>): void {
    this.settings = { ...this.settings, ...settings };
    
    // Reload background image if changed
    if (settings.backgroundImage && settings.backgroundImage !== this.settings.backgroundImage) {
      this.loadBackgroundImage(settings.backgroundImage);
    }
  }

  // Load background image
  private loadBackgroundImage(src: string): void {
    if (this.backgroundImage) {
      this.backgroundImage.onload = null;
      this.backgroundImage.onerror = null;
    }
    
    this.backgroundImage = new Image();
    this.backgroundImage.crossOrigin = 'anonymous';
    this.backgroundImage.src = src;
  }

  // Get current settings
  getSettings(): BackgroundSettings {
    return { ...this.settings };
  }

  // Start processing loop
  start(onFrame: (canvas: HTMLCanvasElement) => void): void {
    this.onFrameCallback = onFrame;
    
    if (!this.initialized || !this.videoElement || !this.context || !this.backgroundContext) {
      console.warn('Background remover not ready');
      return;
    }

    const processFrame = async () => {
      if (!this.videoElement || !this.context || !this.backgroundContext || !this.canvas || !this.backgroundCanvas) {
        this.animationFrameId = requestAnimationFrame(processFrame);
        return;
      }

      // Skip if video not ready
      if (this.videoElement.readyState < 2) {
        this.animationFrameId = requestAnimationFrame(processFrame);
        return;
      }

      try {
        // Send frame to MediaPipe
        const segmentation = await this.selfieSegmentation.send({ image: this.videoElement });
        
        // Draw processed frame
        this.drawProcessedFrame(segmentation);
        
        // Callback with result
        if (this.onFrameCallback) {
          this.onFrameCallback(this.canvas);
        }
      } catch (error) {
        console.error('Segmentation error:', error);
      }

      this.animationFrameId = requestAnimationFrame(processFrame);
          }

          processFrame();
        }

  // Stop processing
  stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.onFrameCallback = null;
  }

  // Draw processed frame with background replacement
  private drawProcessedFrame(segmentation: any): void {
    if (!this.canvas || !this.context || !this.backgroundCanvas || !this.backgroundContext || !this.videoElement) return;

    const { width, height } = this.canvas;
    
    // Clear canvases
    this.context.clearRect(0, 0, width, height);
    this.backgroundContext.clearRect(0, 0, width, height);

    // Get segmentation mask
    const mask = segmentation.segmentationMask;
    if (!mask) return;

    // Draw video to background canvas first (for blur mode)
    this.backgroundContext.save();
    if (this.settings.mirrorPreview) {
      this.backgroundContext.translate(width, 0);
      this.backgroundContext.scale(-1, 1);
    }
    this.backgroundContext.drawImage(this.videoElement, 0, 0, width, height);
    this.backgroundContext.restore();

    // Apply background based on mode
    switch (this.settings.mode) {
      case 'blur':
        this.applyBlurBackground(width, height);
        break;
      case 'image':
        this.applyImageBackground(width, height);
        break;
      case 'color':
        this.applyColorBackground(width, height);
        break;
      case 'none':
      default:
        // Transparent background - already cleared
        break;
    }

    // Now composite: foreground (person) from video + background
    this.context.save();
    
    // Create mask from segmentation
    // MediaPipe returns a tensor, we need to convert to image mask
    // For browser, we'll use the segmentation mask as alpha
    
    // Draw background first
    if (this.settings.mode !== 'none') {
      this.context.drawImage(this.backgroundCanvas, 0, 0);
    }

    // Draw foreground (person) using segmentation mask
    // We use globalCompositeOperation to blend with mask
    this.context.globalCompositeOperation = 'source-over';
    
    // Create a temporary canvas for the masked person
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d')!;
    
    // Draw video to temp canvas
    tempCtx.save();
    if (this.settings.mirrorPreview) {
      tempCtx.translate(width, 0);
      tempCtx.scale(-1, 1);
    }
    tempCtx.drawImage(this.videoElement, 0, 0, width, height);
    tempCtx.restore();

    // Apply segmentation mask as alpha
    // We need to convert the segmentation mask to an alpha channel
    this.applySegmentationMask(tempCanvas, mask, this.settings.segmentationThreshold);

    // Draw the masked person on top
    this.context.drawImage(tempCanvas, 0, 0);
  }

  // Apply blur to background
  private applyBlurBackground(width: number, height: number): void {
    if (!this.backgroundContext || !this.backgroundCanvas) return;
    
    this.backgroundContext.filter = `blur(${this.settings.blurAmount}px)`;
    // Re-draw to apply blur
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(this.backgroundCanvas, 0, 0);
    this.backgroundContext.drawImage(tempCanvas, 0, 0);
    this.backgroundContext.filter = 'none';
  }

  // Apply image background
  private applyImageBackground(width: number, height: number): void {
    if (!this.backgroundContext || !this.backgroundImage) return;
    
    // Draw background image covering the canvas
    const img = this.backgroundImage!;
    const scale = Math.max(width / img.width, height / img.height);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    const x = (width - drawWidth) / 2;
    const y = (height - drawHeight) / 2;
    
    this.backgroundContext.drawImage(img, x, y, drawWidth, drawHeight);
  }

  // Apply solid color background
  private applyColorBackground(width: number, height: number): void {
    if (!this.backgroundContext) return;
    
    this.backgroundContext.fillStyle = this.settings.backgroundColor;
    this.backgroundContext.fillRect(0, 0, width, height);
  }

  // Apply segmentation mask as alpha channel to a canvas
  private applySegmentationMask(canvas: HTMLCanvasElement, mask: any, threshold: number): void {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // MediaPipe segmentation mask is typically a tensor
    // Convert to typed array if needed
    let maskData: Float32Array | Uint8Array;
    if (mask.data instanceof Float32Array) {
      maskData = mask.data;
    } else if (mask.data instanceof Uint8Array) {
      maskData = mask.data;
    } else {
      // Assume it's a tensor with dataSync method
      maskData = mask.dataSync ? mask.dataSync() : new Float32Array(mask.data);
    }

    const width = canvas.width;
    const height = canvas.height;

    // Apply mask as alpha
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const maskIdx = y * width + x;
        const alpha = maskData[maskIdx] || 0;
        
        // Apply threshold
        data[idx + 3] = alpha > threshold ? 255 : Math.round(alpha * 255);
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  // Get processed stream from canvas
  getStream(frameRate = 30): MediaStream | null {
    if (!this.canvas) return null;
    return this.canvas.captureStream(frameRate);
  }

  // Cleanup
  destroy(): void {
    this.stop();
    if (this.selfieSegmentation) {
      this.selfieSegmentation.close();
      this.selfieSegmentation = null;
    }
    this.initialized = false;
    this.canvas = null;
    this.context = null;
    this.backgroundCanvas = null;
    this.backgroundContext = null;
    this.backgroundImage = null;
    this.videoElement = null;
  }
}

// Singleton
export const backgroundRemover = new BackgroundRemover();