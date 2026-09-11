"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useVelocity,
  useTransform,
} from "motion/react";

import {
  CursorProvider as CursorProviderPrimitive,
  Cursor as CursorPrimitive,
  CursorFollow as CursorFollowPrimitive,
  CursorContainer as CursorContainerPrimitive,
  useCursor,
  type CursorProviderProps as CursorProviderPropsPrimitive,
  type CursorContainerProps as CursorContainerPropsPrimitive,
  type CursorProps as CursorPropsPrimitive,
  type CursorFollowProps as CursorFollowPropsPrimitive,
} from "@/components/unlumen-ui/primitives/cursor";
import { cn } from "@/lib/utils";

type CursorProviderProps = Omit<CursorProviderPropsPrimitive, "children"> &
  CursorContainerPropsPrimitive;

function CursorProvider({ global, ...props }: CursorProviderProps) {
  return (
    <CursorProviderPrimitive global={global}>
      <CursorContainerPrimitive {...props} />
    </CursorProviderPrimitive>
  );
}

type CursorProps = Omit<CursorPropsPrimitive, "children" | "asChild">;

function Cursor({ className, ...props }: CursorProps) {
  const { cursorPos } = useCursor();
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  React.useEffect(() => {
    x.set(cursorPos.x);
    y.set(cursorPos.y);
  }, [cursorPos, x, y]);

  // Tighter, snappier spring config for more responsiveness
  const springConfig = { damping: 18, stiffness: 500, mass: 0.4 };
  const smoothX = useSpring(x, springConfig);
  const smoothY = useSpring(y, springConfig);

  const velocityX = useVelocity(smoothX);
  const velocityY = useVelocity(smoothY);

  // Tilt the cursor based on velocity for a gravity feel
  const rotateVelocity = useTransform([velocityX, velocityY], ([vx, vy]) => {
    const rx = ((vx as number) / 1000) * 25;
    const ry = ((vy as number) / 1000) * 25;
    return Math.max(-40, Math.min(40, rx + ry));
  });
  const rotate = useSpring(rotateVelocity, { damping: 12, stiffness: 250 });

  const scale = useTransform([velocityX, velocityY], ([vx, vy]) => {
    const velocity = Math.sqrt((vx as number) ** 2 + (vy as number) ** 2);
    return 1 - Math.min(velocity / 2500, 0.08);
  });

  return (
    <CursorPrimitive
      style={{
        top: smoothY,
        left: smoothX,
        transform: "translate(-4.5%, -11%)",
      }}
      {...props}
    >
      {/* Cursor arrow — smaller (size-4 instead of size-6) */}
      <motion.svg
        className={cn("size-4 text-foreground", className)}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 40 40"
        style={{
          rotate,
          scale,
          transformOrigin: "4.5% 11%",
          filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.25))",
        }}
      >
        <path
          fill="currentColor"
          stroke="white"
          strokeWidth="2"
          d="M1.8 4.4 7 36.2c.3 1.8 2.6 2.3 3.6.8l3.9-5.7c1.7-2.5 4.5-4.1 7.5-4.3l6.9-.5c1.8-.1 2.5-2.4 1.1-3.5L5 2.5c-1.4-1.1-3.5 0-3.3 1.9Z"
        />
      </motion.svg>

      {/* (you) label */}
      <motion.span
        style={{
          position: "absolute",
          // Offset from cursor tip — sits just below and to the right
          top: "70%",
          left: "80%",
          scale,
        }}
        className="pointer-events-none select-none"
      >
        <span
          style={{
            display: "inline-block",
            fontSize: "10px",
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "0.02em",
            color: "#fff",
            background: "#111",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "4px",
            padding: "2px 5px",
            whiteSpace: "nowrap",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }}
        >
          you
        </span>
      </motion.span>
    </CursorPrimitive>
  );
}

type CursorFollowProps = Omit<CursorFollowPropsPrimitive, "asChild">;

function CursorFollow({
  className,
  children,
  sideOffset = 15,
  alignOffset = 5,
  ...props
}: CursorFollowProps) {
  const { cursorPos } = useCursor();
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  React.useEffect(() => {
    x.set(cursorPos.x);
    y.set(cursorPos.y);
  }, [cursorPos, x, y]);

  const springConfig = { damping: 18, stiffness: 500, mass: 0.4 };
  const smoothX = useSpring(x, springConfig);
  const smoothY = useSpring(y, springConfig);

  const velocityX = useVelocity(smoothX);
  const velocityY = useVelocity(smoothY);

  const scaleX = useTransform(velocityX, [-1000, 0, 1000], [0.9, 1, 1.15]);
  const scaleY = useTransform(velocityY, [-1000, 0, 1000], [1.15, 1, 0.9]);

  const skewX = useTransform(velocityX, [-1000, 0, 1000], [-3, 0, 3]);
  const skewY = useTransform(velocityY, [-1000, 0, 1000], [-3, 0, 3]);

  return (
    <CursorFollowPrimitive
      sideOffset={sideOffset}
      alignOffset={alignOffset}
      {...props}
    >
      <motion.div
        className={cn(
          "bg-foreground rounded-md text-background px-2 py-1 text-sm",
          className,
        )}
        style={{
          scaleX,
          scaleY,
          skewX,
          skewY,
        }}
      >
        {children}
      </motion.div>
    </CursorFollowPrimitive>
  );
}

export {
  CursorProvider,
  Cursor,
  CursorFollow,
  type CursorProviderProps,
  type CursorProps,
  type CursorFollowProps,
};
