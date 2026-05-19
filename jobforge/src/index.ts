export type JobHandler = () => void | Promise<void>;

export interface ScheduleOptions {
  /** Run at least every `everyMs` milliseconds. */
  everyMs?: number;
  /** One-shot delay before first run. */
  delayMs?: number;
  /** Max attempts including the first run. */
  retries?: number;
  /** Cap for exponential backoff base (ms). */
  maxBackoffMs?: number;
}

export interface JobStats {
  id: string;
  runs: number;
  failures: number;
  lastError?: string;
  lastRunAt?: number;
}

type InternalJob = {
  id: string;
  fn: JobHandler;
  everyMs?: number;
  timer?: ReturnType<typeof setInterval>;
  timeout?: ReturnType<typeof setTimeout>;
  stats: JobStats;
  opts: Required<Pick<ScheduleOptions, "retries" | "maxBackoffMs">>;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class JobForge {
  private jobs = new Map<string, InternalJob>();

  /** Register a named periodic or delayed job. */
  schedule(id: string, fn: JobHandler, options: ScheduleOptions = {}): void {
    this.cancel(id);
    const retries = options.retries ?? 3;
    const maxBackoffMs = options.maxBackoffMs ?? 30_000;
    const job: InternalJob = {
      id,
      fn,
      everyMs: options.everyMs,
      stats: { id, runs: 0, failures: 0 },
      opts: { retries, maxBackoffMs },
    };
    this.jobs.set(id, job);

    const runOnce = async (attempt = 0) => {
      job.stats.lastRunAt = Date.now();
      job.stats.runs += 1;
      try {
        await fn();
        job.stats.failures = 0;
        job.stats.lastError = undefined;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        job.stats.failures += 1;
        job.stats.lastError = msg;
        if (attempt + 1 < retries) {
          const backoff = Math.min(maxBackoffMs, 100 * Math.pow(2, attempt));
          await sleep(backoff);
          await runOnce(attempt + 1);
        }
      }
    };

    const kickoff = () => {
      void runOnce(0);
      if (job.everyMs && job.everyMs > 0) {
        job.timer = setInterval(() => void runOnce(0), job.everyMs);
      }
    };

    if (options.delayMs && options.delayMs > 0) {
      job.timeout = setTimeout(kickoff, options.delayMs);
    } else {
      kickoff();
    }
  }

  cancel(id: string): void {
    const j = this.jobs.get(id);
    if (!j) return;
    if (j.timer) clearInterval(j.timer);
    if (j.timeout) clearTimeout(j.timeout);
    this.jobs.delete(id);
  }

  monitoring(): JobStats[] {
    return [...this.jobs.values()].map((j) => ({ ...j.stats }));
  }
}

export function jobforge(): JobForge {
  return new JobForge();
}
