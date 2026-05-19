import * as React from "react";
import { Profiler } from "react";

export type RenderReport = {
  id: string;
  phase: "mount" | "update";
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
};

export type RenderGuardOptions = {
  onRender?: (r: RenderReport) => void;
  /** Flag renders slower than threshold (ms). */
  warnMs?: number;
};

/** Create a component that wraps children with React Profiler. */
export function renderguard(
  id: string,
  options: RenderGuardOptions = {},
): React.FC<{ children: React.ReactNode }> {
  const onRender: React.ProfilerOnRenderCallback = (
    profilerId,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
  ) => {
    const r: RenderReport = {
      id: profilerId,
      phase: phase === "mount" ? "mount" : "update",
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
    };
    options.onRender?.(r);
    if (options.warnMs !== undefined && actualDuration > options.warnMs) {
      console.warn(`[renderguard] slow render "${profilerId}": ${actualDuration.toFixed(1)}ms`);
    }
  };

  function Guard({ children }: { children: React.ReactNode }) {
    return (
      <Profiler id={id} onRender={onRender}>
        {children}
      </Profiler>
    );
  }
  Guard.displayName = `RenderGuard(${id})`;
  return Guard;
}

/** Aggregate simple performance score from profiler durations (lower is better). */
export function computeRenderScore(samples: number[]): number {
  if (samples.length === 0) return 100;
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const score = Math.max(0, 100 - avg * 4);
  return Math.round(score);
}

export function watchApp(
  rootName: string,
  options: RenderGuardOptions = {},
): React.FC<{ children: React.ReactNode }> {
  return renderguard(rootName, options);
}
