const WEEKDAY_MAP: Record<string, string> = {
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
  sunday: "SU"
};

function parseTime(timeInput: string): { hour: number; minute: number } {
  const trimmed = timeInput.trim().toLowerCase();
  const twelveHourMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);

  if (twelveHourMatch) {
    const rawHour = Number(twelveHourMatch[1]);
    const minute = Number(twelveHourMatch[2] ?? "0");
    const suffix = twelveHourMatch[3];
    const hour = suffix === "pm" ? (rawHour % 12) + 12 : rawHour % 12;

    return { hour, minute };
  }

  const twentyFourHourMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (twentyFourHourMatch) {
    const hour = Number(twentyFourHourMatch[1]);
    const minute = Number(twentyFourHourMatch[2] ?? "0");
    return { hour: Math.max(0, Math.min(hour, 23)), minute: Math.max(0, Math.min(minute, 59)) };
  }

  return { hour: 9, minute: 0 };
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function nextDailyAt(hour: number, minute: number, now: Date): Date {
  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);

  if (candidate <= now) {
    candidate.setDate(candidate.getDate() + 1);
  }

  return candidate;
}

function parseByDay(value: string): number[] {
  return value
    .split(",")
    .map((day) => day.trim())
    .map((day) => {
      switch (day) {
        case "MO":
          return 1;
        case "TU":
          return 2;
        case "WE":
          return 3;
        case "TH":
          return 4;
        case "FR":
          return 5;
        case "SA":
          return 6;
        case "SU":
          return 0;
        default:
          return -1;
      }
    })
    .filter((day) => day >= 0);
}

function nextWeeklyAt(days: number[], hour: number, minute: number, now: Date): Date {
  const today = now.getDay();

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);

    if (days.includes(candidate.getDay()) && candidate > now && (offset > 0 || candidate.getDay() === today)) {
      return candidate;
    }
  }

  return addHours(now, 24);
}

export interface ParsedSchedule {
  recurrence: string;
  timezone: string;
  nextRunAt: string;
}

export function parseNaturalLanguageSchedule(text: string, timezone: string): ParsedSchedule {
  const normalized = text.trim().toLowerCase();
  const now = new Date();

  const hourlyMatch = normalized.match(/every\s+(\d{1,2})\s+hours?/);
  if (hourlyMatch) {
    const interval = Math.max(1, Math.min(Number(hourlyMatch[1]), 24));
    return {
      recurrence: `FREQ=HOURLY;INTERVAL=${interval}`,
      timezone,
      nextRunAt: addHours(now, interval).toISOString()
    };
  }

  const weekdayMatch = normalized.match(/every\s+weekday\s+at\s+([\w:\s]+)/);
  if (weekdayMatch) {
    const { hour, minute } = parseTime(weekdayMatch[1]);
    const days = [1, 2, 3, 4, 5];

    return {
      recurrence: `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=${hour};BYMINUTE=${minute}`,
      timezone,
      nextRunAt: nextWeeklyAt(days, hour, minute, now).toISOString()
    };
  }

  const dayMatch = normalized.match(/every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+([\w:\s]+)/);
  if (dayMatch) {
    const byday = WEEKDAY_MAP[dayMatch[1]];
    const { hour, minute } = parseTime(dayMatch[2]);
    const dayIndex = parseByDay(byday);

    return {
      recurrence: `FREQ=WEEKLY;BYDAY=${byday};BYHOUR=${hour};BYMINUTE=${minute}`,
      timezone,
      nextRunAt: nextWeeklyAt(dayIndex, hour, minute, now).toISOString()
    };
  }

  const dailyMatch = normalized.match(/daily\s+at\s+([\w:\s]+)/);
  if (dailyMatch) {
    const { hour, minute } = parseTime(dailyMatch[1]);
    return {
      recurrence: `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;BYHOUR=${hour};BYMINUTE=${minute}`,
      timezone,
      nextRunAt: nextDailyAt(hour, minute, now).toISOString()
    };
  }

  return {
    recurrence: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0",
    timezone,
    nextRunAt: nextWeeklyAt([1, 2, 3, 4, 5], 9, 0, now).toISOString()
  };
}

export function nextRunFromRecurrence(recurrence: string, now = new Date()): Date {
  const parts = recurrence.split(";").map((part) => part.trim());
  const values = new Map<string, string>();

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key && value) {
      values.set(key, value);
    }
  }

  const freq = values.get("FREQ");
  if (freq === "HOURLY") {
    const interval = Math.max(1, Number(values.get("INTERVAL") ?? "1"));
    return addHours(now, interval);
  }

  if (freq === "WEEKLY") {
    const hour = Number(values.get("BYHOUR") ?? "9");
    const minute = Number(values.get("BYMINUTE") ?? "0");
    const byDay = parseByDay(values.get("BYDAY") ?? "MO,TU,WE,TH,FR");
    return nextWeeklyAt(byDay.length ? byDay : [1, 2, 3, 4, 5], hour, minute, now);
  }

  return addHours(now, 24);
}
