import { randomBytes } from "node:crypto";
import { Analyzer } from "./analyzer.js";
import { formatWarning } from "./format.js";
import { extractFilterFields } from "./keys.js";
import type {
  MonguardOptions,
  QueryEvent,
  SchemaIndexSpec,
  Warning,
} from "./types.js";

type MongooseLike = {
  Schema?: unknown;
};

type SchemaLike = {
  pre(hook: string, fn: (this: any) => void): unknown;
  post(hook: string, fn: (this: any, result: unknown) => void): unknown;
  indexes?: () => unknown[];
  options?: { collection?: string } & Record<string, unknown>;
  modelName?: string;
};

type QueryLike = {
  op?: string;
  getFilter?: () => Record<string, unknown>;
  getOptions?: () => Record<string, unknown>;
  _fields?: Record<string, unknown> | undefined;
  selected?: () => Record<string, unknown> | undefined;
  model?: { modelName?: string; collection?: { name?: string } };
  _monguardStart?: number;
  _monguardId?: string;
  _monguardCollection?: string;
  _monguardOp?: string;
  _monguardFilter?: Record<string, unknown>;
  _monguardOptions?: Record<string, unknown>;
  _monguardFields?: string[];
  _monguardStack?: string;
  options?: Record<string, unknown>;
};

type AggregateLike = {
  pipeline?: () => Array<Record<string, unknown>>;
  _pipeline?: Array<Record<string, unknown>>;
  model?: () => { modelName?: string; collection?: { name?: string } };
  options?: Record<string, unknown>;
  _monguardStart?: number;
  _monguardId?: string;
  _monguardCollection?: string;
  _monguardModel?: string;
  _monguardStack?: string;
};

const QUERY_HOOKS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "count",
  "countDocuments",
  "estimatedDocumentCount",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "replaceOne",
  "distinct",
] as const;

export interface MonguardHandle {
  plugin: (schema: SchemaLike, schemaOptions?: Record<string, unknown>) => void;
  analyzer: Analyzer;
  stats: () => ReturnType<Analyzer["stats"]>;
  reset: () => void;
  onWarning: (handler: (w: Warning) => void) => () => void;
}

export function monguard(options: MonguardOptions = {}): MonguardHandle {
  const analyzer = new Analyzer(options);
  const logger = options.logger ?? ((line: string) => console.warn(line));
  const silent = options.silent ?? false;
  const handlers: Array<(w: Warning) => void> = [];

  const handle: MonguardHandle = {
    plugin: createPlugin(analyzer, {
      ...options,
      onWarning: (w) => {
        if (!silent) logger(formatWarning(w));
        for (const h of handlers) h(w);
      },
    }),
    analyzer,
    stats: () => analyzer.stats(),
    reset: () => analyzer.reset(),
    onWarning(handler) {
      handlers.push(handler);
      return () => {
        const i = handlers.indexOf(handler);
        if (i >= 0) handlers.splice(i, 1);
      };
    },
  };
  return handle;
}

interface PluginInternalOptions extends MonguardOptions {
  onWarning?: (w: Warning) => void;
}

function createPlugin(analyzer: Analyzer, opts: PluginInternalOptions) {
  return function monguardPlugin(schema: SchemaLike): void {
    registerIndexes(schema, analyzer);

    for (const hook of QUERY_HOOKS) {
      schema.pre(hook, function (this: QueryLike) {
        attachQueryStart(this, analyzer, opts);
      });
      schema.post(hook, function (this: QueryLike, result: unknown) {
        completeQuery(this, analyzer, opts, result);
      });
    }

    schema.pre("aggregate", function (this: AggregateLike) {
      attachAggregateStart(this, analyzer, opts);
    });
    schema.post("aggregate", function (this: AggregateLike, result: unknown) {
      completeAggregate(this, analyzer, opts, result);
    });
  };
}

function registerIndexes(schema: SchemaLike, analyzer: Analyzer): void {
  const collection = (schema.options?.collection as string | undefined) ?? schema.modelName;
  if (!collection) return;
  if (typeof schema.indexes !== "function") return;
  const raw = schema.indexes();
  const specs: SchemaIndexSpec[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry)) continue;
    const [fields, opts] = entry as [Record<string, unknown>, Record<string, unknown> | undefined];
    if (!fields) continue;
    specs.push({
      fields: Object.keys(fields),
      unique: Boolean(opts?.unique),
    });
  }
  analyzer.registerIndexes(collection, specs);
}

function attachQueryStart(query: QueryLike, _analyzer: Analyzer, opts: MonguardOptions): void {
  query._monguardStart = Date.now();
  query._monguardId = randomBytes(6).toString("hex");
  query._monguardOp = query.op ?? "find";
  query._monguardCollection = query.model?.collection?.name ?? query.model?.modelName ?? "unknown";
  try {
    query._monguardFilter = query.getFilter ? query.getFilter() : {};
  } catch {
    query._monguardFilter = {};
  }
  try {
    query._monguardOptions = query.getOptions ? query.getOptions() : {};
  } catch {
    query._monguardOptions = {};
  }
  const selected = (query.selected && query.selected()) ?? query._fields ?? undefined;
  query._monguardFields = selected ? Object.keys(selected) : [];
  if (opts.attachStackTrace) {
    query._monguardStack = new Error().stack;
  }
}

function completeQuery(query: QueryLike, analyzer: Analyzer, opts: PluginInternalOptions, result: unknown): void {
  const startedAt = query._monguardStart ?? Date.now();
  const event: QueryEvent = {
    id: query._monguardId ?? randomBytes(6).toString("hex"),
    op: query._monguardOp ?? query.op ?? "find",
    collection: query._monguardCollection ?? "unknown",
    model: query.model?.modelName ?? query._monguardCollection ?? "unknown",
    filter: query._monguardFilter ?? {},
    fields: query._monguardFields ?? [],
    options: query._monguardOptions ?? {},
    startedAt,
    durationMs: Date.now() - startedAt,
    resultCount: countResults(result),
    stack: query._monguardStack,
  };
  void extractFilterFields(event.filter);
  const warnings = analyzer.observe(event);
  if (opts.onWarning) for (const w of warnings) opts.onWarning(w);
}

function attachAggregateStart(agg: AggregateLike, _analyzer: Analyzer, opts: MonguardOptions): void {
  agg._monguardStart = Date.now();
  agg._monguardId = randomBytes(6).toString("hex");
  const model = typeof agg.model === "function" ? agg.model() : undefined;
  agg._monguardCollection = model?.collection?.name ?? model?.modelName ?? "unknown";
  agg._monguardModel = model?.modelName ?? agg._monguardCollection;
  if (opts.attachStackTrace) agg._monguardStack = new Error().stack;
}

function completeAggregate(
  agg: AggregateLike,
  analyzer: Analyzer,
  opts: PluginInternalOptions,
  result: unknown,
): void {
  const startedAt = agg._monguardStart ?? Date.now();
  const pipeline = typeof agg.pipeline === "function" ? agg.pipeline() : agg._pipeline ?? [];
  const event: QueryEvent = {
    id: agg._monguardId ?? randomBytes(6).toString("hex"),
    op: "aggregate",
    collection: agg._monguardCollection ?? "unknown",
    model: agg._monguardModel ?? agg._monguardCollection ?? "unknown",
    filter: extractAggregateFilter(pipeline),
    fields: [],
    options: agg.options ?? {},
    pipeline,
    startedAt,
    durationMs: Date.now() - startedAt,
    resultCount: countResults(result),
    stack: agg._monguardStack,
  };
  const warnings = analyzer.observe(event);
  if (opts.onWarning) for (const w of warnings) opts.onWarning(w);
}

function extractAggregateFilter(pipeline: Array<Record<string, unknown>>): Record<string, unknown> {
  const match = pipeline.find((stage) => Object.keys(stage)[0] === "$match");
  if (!match) return {};
  const value = match.$match;
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function countResults(result: unknown): number | undefined {
  if (Array.isArray(result)) return result.length;
  if (result === null || result === undefined) return result === null ? 0 : undefined;
  if (typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.matchedCount === "number") return r.matchedCount as number;
    if (typeof r.modifiedCount === "number") return r.modifiedCount as number;
    if (typeof r.deletedCount === "number") return r.deletedCount as number;
    return 1;
  }
  return undefined;
}

export function applyGlobally(mongooseInstance: MongooseLike, options: MonguardOptions = {}): MonguardHandle {
  const handle = monguard(options);
  const mongoose = mongooseInstance as unknown as { plugin: (fn: unknown) => void };
  if (typeof mongoose.plugin === "function") {
    mongoose.plugin(handle.plugin);
  }
  return handle;
}
