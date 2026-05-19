export { Profiler } from "./profiler.js";
export { Histogram, percentile } from "./histogram.js";
export { Tracer } from "./tracer.js";
export { expressMiddleware, dashboardMiddleware } from "./express.js";
export { mongoosePlugin } from "./mongoose.js";
export type {
  HttpRecord,
  QueryRecord,
  MemorySnapshot,
  PerfReport,
  PerfstackOptions,
  RouteSummary,
  HistogramSummary,
  Span,
} from "./types.js";

import { Profiler } from "./profiler.js";
import { dashboardMiddleware, expressMiddleware } from "./express.js";
import { mongoosePlugin } from "./mongoose.js";

type AnyApp = {
  use: (...args: unknown[]) => unknown;
  get?: (path: string, handler: (...args: unknown[]) => unknown) => unknown;
};

export interface InitResult {
  profiler: Profiler;
  middleware: ReturnType<typeof expressMiddleware>;
  dashboard: ReturnType<typeof dashboardMiddleware>;
  mongoosePlugin: ReturnType<typeof mongoosePlugin>;
}

export function init(
  app?: AnyApp,
  options: ConstructorParameters<typeof Profiler>[0] & { dashboardPath?: string } = {},
): InitResult {
  const profiler = new Profiler(options);
  const middleware = expressMiddleware(profiler);
  const dashboard = dashboardMiddleware(profiler);
  const plugin = mongoosePlugin(profiler);
  if (app) {
    app.use(middleware);
    if (typeof app.get === "function") {
      app.get(options.dashboardPath ?? "/__perf", dashboard as unknown as (...a: unknown[]) => unknown);
      app.get((options.dashboardPath ?? "/__perf") + ".json", dashboard as unknown as (...a: unknown[]) => unknown);
    }
  }
  return { profiler, middleware, dashboard, mongoosePlugin: plugin };
}
