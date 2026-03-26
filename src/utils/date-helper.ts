import { DateRange, RunOptions } from "../types";

export function buildDateRange(
  options: Pick<RunOptions, "since" | "until">,
): DateRange {
  const until = options.until ? new Date(options.until) : new Date();
  until.setHours(23, 59, 59, 999);

  let since: Date;
  if (options.since) {
    since = new Date(options.since);
    since.setHours(0, 0, 0, 0);
  } else {
    // Default: yesterday
    since = new Date(until);
    since.setDate(since.getDate() - 1);
    since.setHours(0, 0, 0, 0);
  }

  return { since, until };
}

export function formatDateLabel({ since, until }: DateRange): string {
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return since.toDateString() === until.toDateString()
    ? fmt(since)
    : `${fmt(since)} → ${fmt(until)}`;
}
