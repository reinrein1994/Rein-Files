import {useEffect, useRef} from 'react';

interface PixelSealCelebrationProps {
  triggerKey: number;
  logoUrl: string;
  onComplete?: () => void;
}

interface Sparkle {
  angle: number;
  speed: number;
  size: number;
  color: string;
  phase: number;
}

const GRID_SIZE = 76;
const DURATION_MS = 2200;

function build16BitSealSprite(img: HTMLImageElement): HTMLCanvasElement {
  const off = document.createElement('canvas');
  off.width = GRID_SIZE;
  off.height = GRID_SIZE;
  const ctx = off.getContext('2d', {willReadFrequently: true});
  if (!ctx) return off;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, GRID_SIZE, GRID_SIZE);

  // Fit uploaded seal inside 76x76 sprite grid preserving aspect ratio
  const scale = Math.min((GRID_SIZE - 4) / img.naturalWidth, (GRID_SIZE - 4) / img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const ox = Math.floor((GRID_SIZE - w) / 2);
  const oy = Math.floor((GRID_SIZE - h) / 2);
  ctx.drawImage(img, ox, oy, w, h);

  const imgData = ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
  const data = imgData.data;

  // Flood-fill near-white exterior background starting from edges so no square backdrop remains
  const visited = new Uint8Array(GRID_SIZE * GRID_SIZE);
  const queue: number[] = [];

  const isBgPixel = (idx: number) => {
    const p = idx * 4;
    const a = data[p + 3];
    if (a < 40) return true;
    return data[p] > 226 && data[p + 1] > 226 && data[p + 2] > 226;
  };

  for (let x = 0; x < GRID_SIZE; x++) {
    queue.push(x, (GRID_SIZE - 1) * GRID_SIZE + x);
  }
  for (let y = 1; y < GRID_SIZE - 1; y++) {
    queue.push(y * GRID_SIZE, y * GRID_SIZE + (GRID_SIZE - 1));
  }

  while (queue.length > 0) {
    const curr = queue.pop()!;
    if (visited[curr]) continue;
    visited[curr] = 1;
    if (!isBgPixel(curr)) continue;

    data[curr * 4 + 3] = 0; // Transparent exterior

    const cx = curr % GRID_SIZE;
    const cy = Math.floor(curr / GRID_SIZE);
    if (cx > 0) queue.push(curr - 1);
    if (cx < GRID_SIZE - 1) queue.push(curr + 1);
    if (cy > 0) queue.push(curr - GRID_SIZE);
    if (cy < GRID_SIZE - 1) queue.push(curr + GRID_SIZE);
  }

  // Crisp 16-bit color palette quantization & sharp alpha snap (zero blurry edges)
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 100) {
      data[i + 3] = 0;
      continue;
    }
    data[i + 3] = 255;
    data[i] = Math.min(255, Math.round(data[i] / 16) * 16);
    data[i + 1] = Math.min(255, Math.round(data[i + 1] / 16) * 16);
    data[i + 2] = Math.min(255, Math.round(data[i + 2] / 16) * 16);
  }

  ctx.putImageData(imgData, 0, 0);
  return off;
}

export function PixelSealCelebration({
  triggerKey,
  logoUrl,
  onComplete,
}: PixelSealCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (triggerKey === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;
    let rafId = 0;
    let finishedTimer = 0;

    const sparkles: Sparkle[] = [
      {angle: -Math.PI * 0.85, speed: 68, size: 6, color: '#facc15', phase: 0},
      {angle: -Math.PI * 0.6, speed: 82, size: 5, color: '#2fbf7f', phase: 0.12},
      {angle: -Math.PI * 0.4, speed: 78, size: 6, color: '#3b82f6', phase: 0.08},
      {angle: -Math.PI * 0.15, speed: 70, size: 5, color: '#facc15', phase: 0.2},
      {angle: Math.PI * 0.15, speed: 66, size: 5, color: '#2fbf7f', phase: 0.16},
      {angle: Math.PI * 0.42, speed: 74, size: 6, color: '#facc15', phase: 0.05},
      {angle: Math.PI * 0.62, speed: 72, size: 5, color: '#ef4444', phase: 0.22},
      {angle: Math.PI * 0.88, speed: 68, size: 6, color: '#3b82f6', phase: 0.14},
    ];

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      const sprite = build16BitSealSprite(img);
      const start = performance.now();
      let lastStep = -1;

      const renderFrame = (now: number) => {
        if (cancelled) return;
        const elapsed = now - start;
        const t = Math.min(1, elapsed / DURATION_MS);

        // Stepped 18 FPS tick for authentic 16-bit animation cadence
        const step = Math.floor(elapsed / 55);
        if (step !== lastStep) {
          lastStep = step;
          const W = canvas.width;
          const H = canvas.height;
          ctx.clearRect(0, 0, W, H);
          ctx.imageSmoothingEnabled = false;

          // Playful hop trajectory & squash/stretch
          let yOffset = 0;
          let scaleX = 1;
          let scaleY = 1;
          let tiltRad = 0;
          let alpha = 1;

          if (t < 0.2) {
            // Pop up from bottom
            const p = t / 0.2;
            yOffset = Math.round((1 - Math.sin(p * Math.PI * 0.5)) * 75);
            scaleX = 0.85 + p * 0.25;
            scaleY = 1.15 - p * 0.15;
          } else if (t < 0.78) {
            // Playful double bounce + 16-bit wobble dance
            const p = (t - 0.2) / 0.58;
            const hop = Math.abs(Math.sin(p * Math.PI * 2.5));
            yOffset = -Math.round(hop * 28);
            const squash = hop < 0.15 ? 0.12 : -hop * 0.06;
            scaleX = 1 + squash;
            scaleY = 1 - squash;
            // Stepped retro tilt (-7deg, 0, +7deg)
            const tiltStep = Math.round(Math.sin(p * Math.PI * 5) * 2) / 2;
            tiltRad = tiltStep * 0.13;
          } else {
            // Joyful exit hop & pixel shrink
            const p = (t - 0.78) / 0.22;
            yOffset = -Math.round(p * 64);
            scaleX = Math.max(0.1, 1 - p * 0.75);
            scaleY = Math.max(0.1, 1 - p * 0.75);
            alpha = Math.max(0, 1 - p);
          }

          const spriteSize = 172;
          const cx = Math.round(W / 2);
          const cy = Math.round(H / 2 + yOffset);

          // Draw 16-bit pixel sparkles floating freely around the seal
          for (const sp of sparkles) {
            const st = Math.max(0, Math.min(1, (t - sp.phase) / 0.72));
            if (st <= 0 || st >= 1) continue;
            const dist = 76 + Math.round(st * sp.speed);
            const sx = Math.round((cx + Math.cos(sp.angle) * dist) / 3) * 3;
            const sy = Math.round((cy + Math.sin(sp.angle) * dist - st * 18) / 3) * 3;
            const sz = st > 0.75 ? Math.max(3, sp.size - 2) : sp.size;
            ctx.save();
            ctx.globalAlpha = (1 - st * 0.85) * alpha;
            ctx.fillStyle = sp.color;
            // Crisp 16-bit plus/diamond pixel star (no box)
            ctx.fillRect(sx - sz, sy - Math.floor(sz / 2), sz * 2, sz);
            ctx.fillRect(sx - Math.floor(sz / 2), sy - sz, sz, sz * 2);
            ctx.restore();
          }

          // Draw the 16-bit pixelated scalloped seal directly (zero modal or square container)
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(cx, cy);
          ctx.rotate(tiltRad);
          ctx.scale(scaleX, scaleY);
          ctx.drawImage(
            sprite,
            Math.round(-spriteSize / 2),
            Math.round(-spriteSize / 2),
            spriteSize,
            spriteSize
          );
          ctx.restore();
        }

        if (t < 1) {
          rafId = window.requestAnimationFrame(renderFrame);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          onCompleteRef.current?.();
        }
      };

      rafId = window.requestAnimationFrame(renderFrame);
    };

    img.onerror = () => {
      if (cancelled) return;
      finishedTimer = window.setTimeout(() => onCompleteRef.current?.(), 150);
    };

    img.src = logoUrl || '/logos/nccs-seal.png';

    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (finishedTimer) window.clearTimeout(finishedTimer);
    };
  }, [triggerKey, logoUrl]);

  if (triggerKey === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[80] pointer-events-none flex items-center justify-center"
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        width={360}
        height={360}
        className="w-[290px] h-[290px] sm:w-[340px] sm:h-[340px]"
        style={{
          imageRendering: 'pixelated',
          background: 'transparent',
        }}
      />
    </div>
  );
}
