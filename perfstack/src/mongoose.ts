import type { Profiler } from "./profiler.js";

type SchemaLike = {
  pre(hook: string, fn: (this: any) => void): unknown;
  post(hook: string, fn: (this: any, result: unknown) => void): unknown;
};

const HOOKS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "count",
  "countDocuments",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "distinct",
];

export function mongoosePlugin(profiler: Profiler) {
  return function perfstackMongoose(schema: SchemaLike) {
    for (const hook of HOOKS) {
      schema.pre(hook, function (this: any) {
        this._perfstackStart = Date.now();
        this._perfstackOp = hook;
        this._perfstackCollection = this.model?.collection?.name ?? this.model?.modelName ?? "unknown";
      });
      schema.post(hook, function (this: any) {
        const startedAt = this._perfstackStart ?? Date.now();
        profiler.recordQuery({
          collection: this._perfstackCollection ?? "unknown",
          op: this._perfstackOp ?? hook,
          durationMs: Date.now() - startedAt,
          startedAt,
          traceId: profiler.tracer.currentTraceId(),
        });
      });
    }
    schema.pre("aggregate", function (this: any) {
      this._perfstackStart = Date.now();
      const model = typeof this.model === "function" ? this.model() : undefined;
      this._perfstackCollection = model?.collection?.name ?? model?.modelName ?? "unknown";
    });
    schema.post("aggregate", function (this: any) {
      const startedAt = this._perfstackStart ?? Date.now();
      profiler.recordQuery({
        collection: this._perfstackCollection ?? "unknown",
        op: "aggregate",
        durationMs: Date.now() - startedAt,
        startedAt,
        traceId: profiler.tracer.currentTraceId(),
      });
    });
  };
}
