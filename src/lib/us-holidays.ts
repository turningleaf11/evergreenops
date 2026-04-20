// US Federal Holidays. Returns observed dates for a given year.
// Static rules — no external API call needed.

export interface Holiday {
  name: string;
  date: Date;
  source: "federal" | "workspace";
  color: string;
}

const FEDERAL_COLOR = "hsl(var(--primary))";

const nthWeekdayOfMonth = (year: number, month: number, weekday: number, n: number) => {
  // month: 0-indexed; weekday: 0=Sun..6=Sat; n: 1..5
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
};

const lastWeekdayOfMonth = (year: number, month: number, weekday: number) => {
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - offset);
};

export function getUSFederalHolidays(year: number): Holiday[] {
  return [
    { name: "New Year's Day", date: new Date(year, 0, 1), source: "federal", color: FEDERAL_COLOR },
    { name: "Martin Luther King Jr. Day", date: nthWeekdayOfMonth(year, 0, 1, 3), source: "federal", color: FEDERAL_COLOR },
    { name: "Presidents' Day", date: nthWeekdayOfMonth(year, 1, 1, 3), source: "federal", color: FEDERAL_COLOR },
    { name: "Memorial Day", date: lastWeekdayOfMonth(year, 4, 1), source: "federal", color: FEDERAL_COLOR },
    { name: "Juneteenth", date: new Date(year, 5, 19), source: "federal", color: FEDERAL_COLOR },
    { name: "Independence Day", date: new Date(year, 6, 4), source: "federal", color: FEDERAL_COLOR },
    { name: "Labor Day", date: nthWeekdayOfMonth(year, 8, 1, 1), source: "federal", color: FEDERAL_COLOR },
    { name: "Columbus Day", date: nthWeekdayOfMonth(year, 9, 1, 2), source: "federal", color: FEDERAL_COLOR },
    { name: "Veterans Day", date: new Date(year, 10, 11), source: "federal", color: FEDERAL_COLOR },
    { name: "Thanksgiving", date: nthWeekdayOfMonth(year, 10, 4, 4), source: "federal", color: FEDERAL_COLOR },
    { name: "Christmas Day", date: new Date(year, 11, 25), source: "federal", color: FEDERAL_COLOR },
  ];
}

export function getHolidaysInRange(start: Date, end: Date, federalEnabled = true): Holiday[] {
  const years = new Set<number>();
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) years.add(y);
  const all: Holiday[] = [];
  if (federalEnabled) {
    years.forEach((y) => all.push(...getUSFederalHolidays(y)));
  }
  return all.filter((h) => h.date >= start && h.date <= end);
}
