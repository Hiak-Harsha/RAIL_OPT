import React, { useRef, useState, useEffect } from "react";
import { usePointerPosition } from "../../interaction/usePointerPosition";
import { INTERACTION_CONFIG } from "../../interaction/interactionConfig";

interface MagneticProps {
  children: React.ReactNode;
  tier?: "strong" | "weak" | "safety-ack";
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
}

export const Magnetic: React.FC<MagneticProps> = ({
  children,
  tier = "weak",
  className = "",
  onClick,
  disabled = false,
}) => {
  const { subscribeToPointerMove, reducedMotion } = usePointerPosition();
  const elementRef = useRef<HTMLDivElement>(null);
  const [isLatched, setIsLatched] = useState(false);

  const maxDisplacement =
    tier === "strong"
      ? INTERACTION_CONFIG.magnetic.primaryStrength
      : tier === "weak"
      ? INTERACTION_CONFIG.magnetic.secondaryStrength
      : 0; // "safety-ack" NEVER moves physically

  useEffect(() => {
    if (disabled || reducedMotion || !elementRef.current || maxDisplacement === 0) return;

    let posX = 0;
    let posY = 0;
    let targetX = 0;
    let targetY = 0;
    let animId: number;

    const springK = 0.18;
    const damping = 0.72;
    let velX = 0;
    let velY = 0;

    const updatePhysics = () => {
      const forceX = (targetX - posX) * springK;
      const forceY = (targetY - posY) * springK;
      velX = (velX + forceX) * damping;
      velY = (velY + forceY) * damping;
      posX += velX;
      posY += velY;

      if (elementRef.current) {
        elementRef.current.style.transform = `translate3d(${posX.toFixed(2)}px, ${posY.toFixed(2)}px, 0)`;
      }

      if (Math.abs(velX) > 0.05 || Math.abs(velY) > 0.05 || Math.abs(targetX - posX) > 0.1 || Math.abs(targetY - posY) > 0.1) {
        animId = requestAnimationFrame(updatePhysics);
      }
    };

    const unsubscribe = subscribeToPointerMove((pointer) => {
      if (!elementRef.current || !pointer.isActive) {
        targetX = 0;
        targetY = 0;
        cancelAnimationFrame(animId);
        animId = requestAnimationFrame(updatePhysics);
        return;
      }

      const rect = elementRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = pointer.x - centerX;
      const deltaY = pointer.y - centerY;
      const dist = Math.hypot(deltaX, deltaY);

      if (dist < INTERACTION_CONFIG.awarenessRadius) {
        const factor = (1 - dist / INTERACTION_CONFIG.awarenessRadius) * 0.45;
        targetX = Math.max(-maxDisplacement, Math.min(maxDisplacement, deltaX * factor));
        targetY = Math.max(-maxDisplacement, Math.min(maxDisplacement, deltaY * factor));
      } else {
        targetX = 0;
        targetY = 0;
      }

      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(updatePhysics);
    });

    return () => {
      unsubscribe();
      cancelAnimationFrame(animId);
    };
  }, [disabled, reducedMotion, maxDisplacement, subscribeToPointerMove]);

  const handleClick = (e: React.MouseEvent) => {
    if (tier === "safety-ack") {
      setIsLatched(true);
      setTimeout(() => setIsLatched(false), 400);
    }
    if (onClick) onClick(e);
  };

  return (
    <div
      ref={elementRef}
      onClick={handleClick}
      className={`relative inline-block select-none will-change-transform ${
        tier === "safety-ack" ? "transition-transform active:scale-95" : ""
      } ${isLatched ? "scale-[0.98] ring-2 ring-[#00E676]" : ""} ${className}`}
    >
      {children}
    </div>
  );
};
