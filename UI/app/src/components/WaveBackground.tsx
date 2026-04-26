import { useRef } from 'react';
import { useWaveShader } from '@/hooks/useWaveShader';

export function WaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWaveShader(canvasRef);

  return (
    <canvas ref={canvasRef} className="site-wave-canvas" aria-hidden="true" />
  );
}
