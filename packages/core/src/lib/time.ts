/** 시각·기간 표기 유틸리티. 화면과 CSV가 같은 형식을 쓰도록 여기로 모은다. */

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 자정 기준 경과 분 → "14:30". 24시를 넘어가면 다음 날로 감싼다. */
export function formatClock(minutesFromMidnight: number): string {
  const normalized = ((minutesFromMidnight % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / MINUTES_PER_HOUR);
  const minutes = Math.round(normalized % MINUTES_PER_HOUR);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** "09:00" → 540. 형식이 어긋나면 0. */
export function parseClock(clock: string): number {
  const [hourPart, minutePart] = clock.split(':');
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * MINUTES_PER_HOUR + minutes;
}

/** 소요시간 → "2시간 30분" / "45분". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / MINUTES_PER_HOUR);
  const remainder = total % MINUTES_PER_HOUR;
  if (hours === 0) return `${remainder}분`;
  if (remainder === 0) return `${hours}시간`;
  return `${hours}시간 ${remainder}분`;
}

/** ISO 날짜(yyyy-mm-dd) → "2026.06.18". */
export function formatIsoDate(isoDate: string): string {
  return isoDate.replaceAll('-', '.');
}

/** 두 ISO 날짜 사이의 일수. 문서 갱신일 경과를 재는 데 쓴다. */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / MS_PER_DAY);
}

/** 밀리초 → "1.2초". 응답시간 표기에 쓴다. */
export function formatElapsed(milliseconds: number): string {
  if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
  return `${(milliseconds / 1000).toFixed(1)}초`;
}

/** ISO 8601 타임스탬프. 로그 기록 형식을 한 곳으로 모은다. */
export function toIsoTimestamp(date: Date): string {
  return date.toISOString();
}

/** 로그 표시용 "2026-08-10 14:32:05" (로컬 시각). */
export function formatTimestamp(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return isoTimestamp;
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ` +
    `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`
  );
}
