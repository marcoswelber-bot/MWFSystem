export const AGENDA_TIME_ZONE = "America/Sao_Paulo";

export type AgendaViewMode = "day" | "week" | "month";

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return { year: read("year"), month: read("month"), day: read("day") };
}

export function getAgendaToday(
  date = new Date(),
  timeZone = AGENDA_TIME_ZONE
) {
  const { year, month, day } = dateParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

export function isAgendaDateKey(value?: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function fromDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, amount: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

export function getAgendaVisibleRange(
  selectedDate: string,
  viewMode: AgendaViewMode = "month"
) {
  if (!isAgendaDateKey(selectedDate)) {
    throw new Error("Data selecionada invalida.");
  }
  const selected = fromDateKey(selectedDate);
  if (viewMode === "day") {
    return { start: selectedDate, end: selectedDate };
  }
  if (viewMode === "week") {
    const weekStart = addDays(selected, -selected.getUTCDay());
    return { start: toDateKey(weekStart), end: toDateKey(addDays(weekStart, 6)) };
  }
  const monthStart = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1));
  const gridStart = addDays(monthStart, -monthStart.getUTCDay());
  return { start: toDateKey(gridStart), end: toDateKey(addDays(gridStart, 41)) };
}
