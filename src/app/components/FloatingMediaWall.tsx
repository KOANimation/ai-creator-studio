// app/components/FloatingMediaWall.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Tile = {
  src: string;
  w: number;
  h: number;
  x: number; // percent
  y: number; // percent
  z: number;
  r: number;
  driftX: number;
  driftY: number;
  speed: number;
  dragX: number; // px
  dragY: number; // px
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function FloatingMediaWall() {
  // ✅ Uniform tile size (all the same)
  const TILE_W = 420;
  const TILE_H = 260;

  // ✅ 16 sources (1..16)
  const sources = useMemo(
    () => [
      "/backgrounds/1.mp4",
      "/backgrounds/2.mp4",
      "/backgrounds/3.mp4",
      "/backgrounds/4.mp4",
      "/backgrounds/5.mp4",
      "/backgrounds/6.mp4",
      "/backgrounds/7.mp4",
      "/backgrounds/8.mp4",
      "/backgrounds/9.mp4",
      "/backgrounds/10.mp4",
      "/backgrounds/11.mp4",
      "/backgrounds/12.mp4",
      "/backgrounds/13.mp4",
      "/backgrounds/14.mp4",
      "/backgrounds/15.mp4",
      "/backgrounds/16.mp4",
    ],
    []
  );

  /**
   * ✅ 16 layout slots => 16 tiles will render
   * x/y are percentages relative to the viewport
   * z: depth (lower = closer)
   */
  const layout = useMemo(
    () => [
      // top row
      { x: 14, y: 18, z: 0.72, r: -12 },
      { x: 34, y: 16, z: 0.66, r: 6 },
      { x: 54, y: 16, z: 0.62, r: -4 },
      { x: 74, y: 18, z: 0.66, r: 10 },
      { x: 92, y: 22, z: 0.78, r: 14 },

      // mid row
      { x: 10, y: 46, z: 0.82, r: -10 },
      { x: 28, y: 48, z: 0.70, r: -6 },
      { x: 48, y: 50, z: 0.45, r: 0 }, // center-ish (closest)
      { x: 68, y: 48, z: 0.70, r: 8 },
      { x: 90, y: 48, z: 0.84, r: 12 },

      // bottom row
      { x: 16, y: 78, z: 0.80, r: -12 },
      { x: 36, y: 82, z: 0.74, r: 6 },
      { x: 56, y: 84, z: 0.78, r: -6 },
      { x: 76, y: 82, z: 0.74, r: 10 },
      { x: 94, y: 78, z: 0.86, r: 14 },

      // extra edge accent
      { x: 6, y: 70, z: 0.88, r: -16 },
    ],
    []
  );

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 }); // -0.5..0.5
  const [time, setTime] = useState(0);
  const [tiles, setTiles] = useState<Tile[] | null>(null);

  // Drag state
  const dragRef = useRef<{
    active: boolean;
    index: number;
    startClientX: number;
    startClientY: number;
    startDragX: number;
    startDragY: number;
    raf: number;
    nextDX: number;
    nextDY: number;
  }>({
    active: false,
    index: -1,
    startClientX: 0,
    startClientY: 0,
    startDragX: 0,
    startDragY: 0,
    raf: 0,
    nextDX: 0,
    nextDY: 0,
  });

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // ✅ Create tiles (16 tiles because layout has 16 entries)
  useEffect(() => {
    const t: Tile[] = layout.map((p, i) => ({
      src: sources[i % sources.length],
      w: TILE_W,
      h: TILE_H,
      x: p.x,
      y: p.y,
      z: p.z,
      r: p.r,
      driftX: (Math.random() * 2 - 1) * 14,
      driftY: (Math.random() * 2 - 1) * 14,
      speed: 0.55 + Math.random() * 0.65,
      dragX: 0,
      dragY: 0,
    }));
    setTiles(t);
  }, [layout, sources]);

  // Pointer tracking (parallax)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      mouseRef.current = { x: mx - 0.5, y: my - 0.5 };
    };

    const onLeave = () => {
      mouseRef.current = { x: 0, y: 0 };
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  // Drift animation loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((t) => t + dt);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Dragging
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const flush = () => {
      const d = dragRef.current;
      d.raf = 0;
      if (!d.active || d.index < 0) return;

      setTiles((prev) => {
        if (!prev) return prev;
        const next = [...prev];
        const t = next[d.index];
        if (!t) return prev;
        next[d.index] = { ...t, dragX: d.nextDX, dragY: d.nextDY };
        return next;
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const tileEl = target?.closest?.("[data-tile-index]") as HTMLElement | null;
      if (!tileEl) return;

      const indexStr = tileEl.getAttribute("data-tile-index");
      const index = indexStr ? Number(indexStr) : -1;
      if (!Number.isFinite(index) || index < 0) return;

      e.preventDefault();
      tileEl.setPointerCapture?.(e.pointerId);

      const d = dragRef.current;
      d.active = true;
      d.index = index;
      d.startClientX = e.clientX;
      d.startClientY = e.clientY;

      const current = tiles?.[index];
      d.startDragX = current?.dragX ?? 0;
      d.startDragY = current?.dragY ?? 0;
      d.nextDX = d.startDragX;
      d.nextDY = d.startDragY;

      setDraggingIndex(index);
    };

    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d.active || d.index < 0) return;

      const dx = e.clientX - d.startClientX;
      const dy = e.clientY - d.startClientY;

      d.nextDX = d.startDragX + dx;
      d.nextDY = d.startDragY + dy;

      if (!d.raf) d.raf = requestAnimationFrame(flush);
    };

    const endDrag = () => {
      const d = dragRef.current;
      if (d.raf) cancelAnimationFrame(d.raf);
      d.raf = 0;
      d.active = false;
      d.index = -1;
      setDraggingIndex(null);
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles]);

  if (!tiles) return null;

  const mouse = mouseRef.current;

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 overflow-hidden"
      style={{ touchAction: "none" }}
    >
      {/* Dark vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(0,0,0,0.00)_0%,rgba(0,0,0,0.35)_60%,rgba(0,0,0,0.75)_100%)]" />

      {/* Subtle purple atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.12),transparent_58%),radial-gradient(circle_at_80%_35%,rgba(147,51,234,0.08),transparent_62%)]" />

      {tiles.map((tile, i) => {
        const depth = 1 - tile.z;
        const px = mouse.x * 80 * depth;
        const py = mouse.y * 60 * depth;

        const drift =
          Math.sin(time * tile.speed + i) * tile.driftX +
          Math.cos(time * tile.speed + i) * tile.driftY;

        const scale = 1 + (1 - tile.z) * 0.09;

        const opacity = clamp(1 - tile.z * 0.08, 0.92, 1);
        const shadow = clamp(0.45 + (1 - tile.z) * 0.65, 0.45, 0.92);

        const dragX = tile.dragX ?? 0;
        const dragY = tile.dragY ?? 0;

        const isDragging = draggingIndex === i;

        return (
          <div
            key={`${tile.src}-${i}`}
            data-tile-index={i}
            className="absolute will-change-transform"
            style={{
              left: `${tile.x}%`,
              top: `${tile.y}%`,
              transform: `translate(-50%, -50%) translate3d(${px + drift + dragX}px, ${
                py + drift * 0.4 + dragY
              }px, 0) rotate(${tile.r}deg) scale(${scale})`,
              opacity,
              // ✅ Keep tiles BELOW hero text layer (which is z-[1000])
              zIndex: isDragging ? 900 : Math.round((1 - tile.z) * 100),
              cursor: isDragging ? "grabbing" : "grab",
              userSelect: "none",
            }}
          >
            {/* glow behind tile */}
            <div
              className="pointer-events-none absolute -inset-6 rounded-[28px]"
              style={{
                background:
                  "radial-gradient(circle at 30% 25%, rgba(168,85,247,0.18), transparent 58%)",
                filter: "blur(18px)",
                opacity: clamp(0.35 + (1 - tile.z) * 0.55, 0.35, 0.95),
              }}
            />

            {/* Tile chrome */}
            <div
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-black"
              style={{
                width: tile.w,
                height: tile.h,
                boxShadow: `0 30px 95px rgba(0,0,0,${shadow})`,
              }}
            >
              <video
                className="h-full w-full object-cover"
                src={tile.src}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                draggable={false}
              />

              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,transparent_55%,rgba(0,0,0,0.28)_100%)]" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.12),transparent_30%)]" />
            </div>
          </div>
        );
      })}

      {/* grain / scanlines */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:100%_9px]" />
    </div>
  );
}