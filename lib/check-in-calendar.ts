export const checkInTimeZone = "Asia/Shanghai" as const;
export function beijingDateKey(timestamp = Date.now()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: checkInTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(timestamp));
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function nextBeijingMidnight(timestamp: number) {
  const [year, month, day] = beijingDateKey(timestamp).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1) - 8 * 3600_000).toISOString();
}
function previousDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}
// An unsigned today keeps yesterday's streak alive until the next Beijing midnight.
export function consecutiveCheckInProgress(dates: string[], today: string) {
  const signed = new Set(dates);
  let date = signed.has(today) ? today : previousDate(today);
  let currentStreak = 0; let streakStart: string | null = null;
  while (signed.has(date)) { currentStreak++; streakStart = date; date = previousDate(date); }
  return { currentStreak, streakStart };
}
export function validCalendarMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1970;
}
export function moveCalendarMonth(month: string, delta: number) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function calendarDaySlots(month: string): (string | null)[] {
  if (!validCalendarMonth(month)) return [];
  const [year, number] = month.split("-").map(Number);
  const leading = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const size = Math.ceil((leading + count) / 7) * 7;
  return Array.from({ length: size }, (_, index) => index < leading || index >= leading + count ? null : `${month}-${String(index - leading + 1).padStart(2, "0")}`);
}
