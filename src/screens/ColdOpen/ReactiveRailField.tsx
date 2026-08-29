import React, { useEffect, useRef } from "react";
import { usePointerPosition } from "../../interaction/InteractionProvider";

export const ReactiveRailField: React.FC<{ className?: string }> = ({ className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { pointerRef, reducedMotion } = usePointerPosition();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reducedMotion) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener("resize", handleResize);

    const gridSpacing = 40;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const pointer = pointerRef.current;
      const mouseX = pointer.isActive ? pointer.x : -999;
      const mouseY = pointer.isActive ? pointer.y : -999;
      const speed = pointer.speed || 0;

      // Draw Precision Railway Grid Lines & Tick Crosses
      ctx.lineWidth = 0.5;

      for (let x = 0; x < width; x += gridSpacing) {
        for (let y = 0; y < height; y += gridSpacing) {
          const dist = Math.hypot(mouseX - x, mouseY - y);
          const maxDist = 160;

          let alpha = 0.04;
          let offset = 0;

          if (dist < maxDist) {
            const factor = 1 - dist / maxDist;
            alpha += factor * 0.35;
            // Subtle directional displacement along cursor velocity
            if (speed > 100) {
              offset = (factor * Math.min(speed, 600)) / 100.0;
            }
          }

          ctx.fillStyle = `rgba(255, 140, 26, ${alpha})`;
          ctx.strokeStyle = `rgba(140, 154, 142, ${alpha * 0.7})`;

          // Draw small railway track alignment tick (+)
          const crossSize = 3;
          ctx.beginPath();
          ctx.moveTo(x - crossSize + offset, y);
          ctx.lineTo(x + crossSize + offset, y);
          ctx.moveTo(x + offset, y - crossSize);
          ctx.lineTo(x + offset, y + crossSize);
          ctx.stroke();

          // Draw kilometer post dot on major interval
          if (x % (gridSpacing * 3) === 0 && y % (gridSpacing * 2) === 0) {
            ctx.beginPath();
            ctx.arc(x + offset, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Cursor Ambient Proximity Glow Aura
      if (pointer.isActive && mouseX >= 0) {
        const grad = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 180);
        grad.addColorStop(0, "rgba(255, 140, 26, 0.07)");
        grad.addColorStop(0.5, "rgba(229, 169, 60, 0.02)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [pointerRef, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full pointer-events-none absolute inset-0 ${className}`}
    />
  );
};
