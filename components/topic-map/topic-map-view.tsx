"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { cn } from "@/lib/utils";

// ── Public data shape ─────────────────────────────────────────────────────────

export type ConceptNode = {
  id: string;
  topic: string;
  parentTopic: string | null;
  mastery: number;
  difficultyTier: string;
};

// ── Internal graph model ──────────────────────────────────────────────────────

interface GNode extends SimulationNodeDatum {
  id: string;
  topic: string;
  mastery: number; // -1 for hub (category) nodes
  tier?: string;
  parentTopic?: string | null;
  isHub: boolean;
  r: number;
}
interface GLink extends SimulationLinkDatum<GNode> {
  source: string | GNode;
  target: string | GNode;
}

function nodeFill(n: GNode): string {
  if (n.isHub) return "#94a3b8"; // slate-400
  if (n.mastery >= 0.7) return "#4ade80"; // green-400
  if (n.mastery >= 0.4) return "#fbbf24"; // amber-400
  return "#f87171"; // red-400
}

function linkId(l: GLink): string {
  const s = typeof l.source === "string" ? l.source : l.source.id;
  const t = typeof l.target === "string" ? l.target : l.target.id;
  return `${s}::${t}`;
}
function endId(e: string | GNode): string {
  return typeof e === "string" ? e : e.id;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TopicMapView({ concepts }: { concepts: ConceptNode[] }) {
  // Build nodes + links once per concept set. Simulation mutates these in place.
  const { nodes, links, adjacency } = useMemo(() => {
    const byTopic = new Map(concepts.map((c) => [c.topic, c]));
    const nodeMap = new Map<string, GNode>();
    for (const c of concepts) {
      nodeMap.set(c.id, {
        id: c.id,
        topic: c.topic,
        mastery: c.mastery,
        tier: c.difficultyTier,
        parentTopic: c.parentTopic,
        isHub: false,
        r: 9 + c.mastery * 9,
      });
    }
    const links: GLink[] = [];
    for (const c of concepts) {
      if (!c.parentTopic) continue;
      const parent = byTopic.get(c.parentTopic);
      if (parent && parent.id !== c.id) {
        links.push({ source: c.id, target: parent.id });
      } else if (!parent) {
        const hubId = `hub:${c.parentTopic}`;
        if (!nodeMap.has(hubId)) {
          nodeMap.set(hubId, { id: hubId, topic: c.parentTopic, mastery: -1, isHub: true, r: 7 });
        }
        links.push({ source: c.id, target: hubId });
      }
    }
    // Neighbor adjacency for hover highlighting.
    const adjacency = new Map<string, Set<string>>();
    for (const l of links) {
      const s = endId(l.source);
      const t = endId(l.target);
      (adjacency.get(s) ?? adjacency.set(s, new Set()).get(s)!).add(t);
      (adjacency.get(t) ?? adjacency.set(t, new Set()).get(t)!).add(s);
    }
    // Seed deterministic initial positions (phyllotaxis spread) so nodes paint
    // immediately, before the simulation's first tick recenters them.
    const nodeArr = Array.from(nodeMap.values());
    nodeArr.forEach((n, i) => {
      const angle = i * 2.399963; // golden angle
      const radius = 30 + i * 6;
      n.x = Math.cos(angle) * radius;
      n.y = Math.sin(angle) * radius;
    });
    return { nodes: nodeArr, links, adjacency };
  }, [concepts]);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<Simulation<GNode, GLink> | null>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [, setTick] = useState(0); // bump to re-render on each simulation tick
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<GNode | null>(null);

  // Track the current pointer interaction (background pan or node drag).
  const drag = useRef<
    | { mode: "pan"; startX: number; startY: number; ox: number; oy: number }
    | { mode: "node"; node: GNode }
    | null
  >(null);

  // ── Measure the container ───────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ── Run the force simulation ────────────────────────────────────────────────
  useEffect(() => {
    if (nodes.length === 0 || size.w === 0) return;
    const sim = forceSimulation<GNode>(nodes)
      .force(
        "link",
        forceLink<GNode, GLink>(links)
          .id((d) => d.id)
          .distance((l) => ((l.source as GNode).isHub || (l.target as GNode).isHub ? 55 : 90))
          .strength(0.5)
      )
      .force("charge", forceManyBody().strength(-320))
      .force("center", forceCenter(size.w / 2, size.h / 2))
      .force("collide", forceCollide<GNode>().radius((d) => d.r + 6))
      .force("x", forceX(size.w / 2).strength(0.04))
      .force("y", forceY(size.h / 2).strength(0.04))
      .on("tick", () => setTick((t) => t + 1));
    simRef.current = sim;
    return () => {
      sim.stop();
    };
  }, [nodes, links, size.w, size.h]);

  // ── Pointer → world-coordinate conversion ───────────────────────────────────
  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      const sx = clientX - (rect?.left ?? 0);
      const sy = clientY - (rect?.top ?? 0);
      return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k };
    },
    [view]
  );

  // ── Global pointer move / up (for smooth drag + pan) ────────────────────────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (d.mode === "pan") {
        setView((v) => ({ ...v, x: d.ox + (e.clientX - d.startX), y: d.oy + (e.clientY - d.startY) }));
      } else {
        const p = toWorld(e.clientX, e.clientY);
        d.node.fx = p.x;
        d.node.fy = p.y;
        simRef.current?.alphaTarget(0.3).restart();
      }
    };
    const onUp = () => {
      const d = drag.current;
      if (d?.mode === "node") {
        d.node.fx = null;
        d.node.fy = null;
        simRef.current?.alphaTarget(0);
      }
      drag.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [toWorld]);

  const onWheel = (e: React.WheelEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    const cx = e.clientX - (rect?.left ?? 0);
    const cy = e.clientY - (rect?.top ?? 0);
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const k = Math.max(0.25, Math.min(3, v.k * factor));
      // keep the world point under the cursor fixed
      const wx = (cx - v.x) / v.k;
      const wy = (cy - v.y) / v.k;
      return { k, x: cx - wx * k, y: cy - wy * k };
    });
  };

  const startPan = (e: React.PointerEvent) => {
    if (e.target !== svgRef.current) return; // only when the background is grabbed
    drag.current = { mode: "pan", startX: e.clientX, startY: e.clientY, ox: view.x, oy: view.y };
    setSelected(null);
  };

  const startNodeDrag = (e: React.PointerEvent, node: GNode) => {
    e.stopPropagation();
    drag.current = { mode: "node", node };
  };

  const resetView = () => setView({ x: 0, y: 0, k: 1 });

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (concepts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        No concepts yet. Start a learning session to build your knowledge graph.
      </div>
    );
  }

  const total = concepts.length;
  const avgMastery = total > 0 ? concepts.reduce((a, c) => a + c.mastery, 0) / total : 0;
  const neighbors = hovered ? adjacency.get(hovered) ?? new Set<string>() : null;

  const isDimmed = (id: string) =>
    hovered !== null && id !== hovered && !(neighbors?.has(id) ?? false);

  return (
    <div ref={containerRef} className="relative h-[calc(100dvh-5rem)] w-full overflow-hidden">
      {/* Header */}
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <h1 className="text-2xl font-semibold">Topic Map</h1>
        <p className="text-sm text-muted-foreground">
          {total} concept{total !== 1 ? "s" : ""} · {Math.round(avgMastery * 100)}% avg mastery
        </p>
      </div>

      {/* Controls */}
      <button
        type="button"
        onClick={resetView}
        className="absolute right-4 top-4 z-10 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm hover:text-foreground"
      >
        Reset view
      </button>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-col gap-1 text-xs text-muted-foreground">
        <LegendDot color="#4ade80" label="Strong (≥70%)" />
        <LegendDot color="#fbbf24" label="Developing (40–69%)" />
        <LegendDot color="#f87171" label="Weak (<40%)" />
        <LegendDot color="#94a3b8" label="Category" />
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="absolute right-4 bottom-4 z-10 w-60 rounded-xl border bg-background p-4 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-snug">{selected.topic}</p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-muted-foreground hover:text-foreground text-sm leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          {selected.isHub ? (
            <p className="mt-1 text-xs text-muted-foreground">Category</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
              {selected.parentTopic && <p>Parent: {selected.parentTopic}</p>}
              {selected.tier && <p className="capitalize">Tier: {selected.tier}</p>}
              <p>{Math.round(selected.mastery * 100)}% mastery</p>
            </div>
          )}
        </div>
      )}

      {/* Graph */}
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        onWheel={onWheel}
        onPointerDown={startPan}
        className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {/* Links */}
          {links.map((l) => {
            const s = l.source as GNode;
            const t = l.target as GNode;
            if (s.x == null || t.x == null) return null;
            const active = hovered != null && (endId(l.source) === hovered || endId(l.target) === hovered);
            return (
              <line
                key={linkId(l)}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                className="stroke-foreground"
                strokeWidth={active ? 1.5 : 1}
                strokeOpacity={hovered ? (active ? 0.5 : 0.06) : 0.15}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            if (n.x == null || n.y == null) return null;
            const dim = isDimmed(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                className="cursor-pointer"
                opacity={dim ? 0.2 : 1}
                onPointerDown={(e) => startNodeDrag(e, n)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(n);
                }}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered((h) => (h === n.id ? null : h))}
              >
                <circle
                  r={n.r}
                  fill={n.isHub ? "transparent" : nodeFill(n)}
                  stroke={nodeFill(n)}
                  strokeWidth={n.isHub ? 1.5 : selected?.id === n.id ? 3 : 1.5}
                  strokeDasharray={n.isHub ? "3 2" : undefined}
                  className={selected?.id === n.id ? "stroke-foreground" : ""}
                />
                <text
                  x={n.r + 4}
                  y={4}
                  className="pointer-events-none select-none fill-current text-foreground"
                  style={{ fontSize: 11, fontWeight: n.isHub ? 600 : 400 }}
                  opacity={n.isHub ? 0.9 : 0.75}
                >
                  {n.topic}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}
