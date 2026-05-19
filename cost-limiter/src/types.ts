export type Dimension = "user" | "team" | "apiKey" | "global" | string;
export type Window = "minute" | "hour" | "day" | "month";

export interface WindowBudget {
  minute?: number;
  hour?: number;
  day?: number;
  month?: number;
}

export interface BudgetConfig {
  perUser?: WindowBudget;
  perTeam?: WindowBudget;
  perApiKey?: WindowBudget;
  global?: WindowBudget;
}

export interface UsageReport {
  dimension: Dimension;
  key: string;
  spend: Record<Window, number>;
  limit: Record<Window, number | undefined>;
}

export interface BudgetWarningEvent {
  dimension: Dimension;
  key: string;
  window: Window;
  used: number;
  limit: number;
  percent: number;
}
