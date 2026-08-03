/**
 * Training plan — data model and schedule logic.
 *
 * Single place to edit the plan. The format follows the sport: a tennis
 * session is not an interval session, so it does not get an interval layout.
 *
 *   sets      strength — fixed 3 × 15 straight sets, explicit rests
 *   steady    cardio / long / recovery — minutes scale, heart rate fixed
 *   intervals rowing / SkiErg / rope / stairs — interval count scales
 *   play      tennis — a duration; the game supplies the intensity
 *
 * Every option declares the locations it works in. Location is the only axis
 * the UI turns into tabs — indoor, outdoor, travelling — and a day may offer
 * several options at one location, which are listed rather than tabbed. An
 * option can sit in two places at once: kettlebell work is the same in the
 * living room or the garden, so indoor and outdoor collapse into one "Home"
 * button on those days (see locationGroups).
 *
 * Limits: Tue/Wed cap at 60 min, Saturday floors at 120 min. Strength is
 * never expressed in minutes and does not scale — it progresses by load.
 */

export type SessionKind =
  | "strength"
  | "cardio"
  | "intensity"
  | "long"
  | "recovery"
  | "rest";

export type PlanPhase = "Base" | "Build" | "Peak" | "Deload" | "Test";

export type Format = "sets" | "steady" | "intervals" | "play";

/**
 * Where the session happens. These three are the only tabs in the UI —
 * everything else a day offers is a list item inside the chosen location.
 */
export type Location = "indoor" | "outdoor" | "travel";

export const LOCATIONS: { key: Location; label: string }[] = [
  { key: "indoor", label: "Indoor" },
  { key: "outdoor", label: "Outdoor" },
  { key: "travel", label: "Travelling" },
];

export interface Exercise {
  name: string;
  reps: string;
}

export interface OptionTemplate {
  key: string;
  label: string;
  /** an option can belong to more than one — kettlebell work is the same in or out */
  locations: Location[];
  sports: string[];
  format: Format;
  /* sets */
  sets?: number;
  reps?: string;
  restSets?: string;
  restExercises?: string;
  exercises?: Exercise[];
  /* steady + play */
  minutes?: number;
  hr?: string;
  style?: string;
  /* intervals */
  warmup?: number;
  work?: string;
  workMinutes?: number;
  recovery?: string;
  recoveryMinutes?: number;
  cooldown?: number;
}

export interface DayTemplate {
  weekday: number;
  short: string;
  long: string;
  focus: string;
  kind: SessionKind;
  maxMinutes?: number;
  minMinutes?: number;
  options: OptionTemplate[];
}

export interface PlanWeek {
  week: number;
  block: string;
  phase: PlanPhase;
  volume: number;
}

/* ------------------------------------------------------------------ */

/** Monday 10 August 2026 — local time, no timezone maths. */
export const PLAN_START = new Date(2026, 7, 10);
export const PLAN_WEEK_COUNT = 12;
export const WEEKDAY_CAP = 60;
export const LONG_DAY_FLOOR = 120;

export const PLAN_WEEKS: PlanWeek[] = [
  { week: 1, block: "Foundation", phase: "Base", volume: 0.75 },
  { week: 2, block: "Foundation", phase: "Build", volume: 0.85 },
  { week: 3, block: "Foundation", phase: "Build", volume: 0.95 },
  { week: 4, block: "Foundation", phase: "Deload", volume: 0.7 },
  { week: 5, block: "Build", phase: "Build", volume: 0.9 },
  { week: 6, block: "Build", phase: "Build", volume: 1.0 },
  { week: 7, block: "Build", phase: "Build", volume: 1.1 },
  { week: 8, block: "Build", phase: "Deload", volume: 0.75 },
  { week: 9, block: "Peak", phase: "Build", volume: 1.05 },
  { week: 10, block: "Peak", phase: "Build", volume: 1.15 },
  { week: 11, block: "Peak", phase: "Peak", volume: 1.25 },
  { week: 12, block: "Peak", phase: "Test", volume: 0.95 },
];

/* ------------------------------------------------------------------ */
/* The canonical week                                                  */
/* ------------------------------------------------------------------ */

const HR_STEADY = "110–130 bpm";
const HR_EASY = "under 110 bpm";

/* straight sets, not a circuit — the same prescription on both strength days */
const STRENGTH_SETS = 3;
const STRENGTH_REPS = "15";
const REST_SETS = "90 s";
const REST_EXERCISES = "2 min";

export const DAY_TEMPLATES: DayTemplate[] = [
  {
    weekday: 1,
    short: "Mon",
    long: "Monday",
    focus: "Strength",
    kind: "strength",
    options: [
      {
        key: "kettlebell",
        label: "Kettlebell & band",
        locations: ["indoor", "outdoor"],
        sports: ["Kettlebell", "Band", "Bodyweight"],
        format: "sets",
        sets: STRENGTH_SETS,
        reps: STRENGTH_REPS,
        restSets: REST_SETS,
        restExercises: REST_EXERCISES,
        exercises: [
          { name: "Kettlebell swing", reps: "15" },
          { name: "Goblet squat", reps: "15" },
          { name: "Push-up", reps: "15" },
          { name: "Band row", reps: "15" },
          { name: "Plank", reps: "45 s" },
        ],
      },
      {
        key: "travel",
        label: "Bodyweight",
        locations: ["travel"],
        sports: ["Bodyweight"],
        format: "sets",
        sets: STRENGTH_SETS,
        reps: STRENGTH_REPS,
        restSets: REST_SETS,
        restExercises: REST_EXERCISES,
        exercises: [
          { name: "Squat", reps: "15" },
          { name: "Push-up", reps: "15" },
          { name: "Split squat", reps: "15 / leg" },
          { name: "Plank", reps: "60 s" },
          { name: "Side plank", reps: "30 s / side" },
        ],
      },
    ],
  },
  {
    weekday: 2,
    short: "Tue",
    long: "Tuesday",
    focus: "Cardio",
    kind: "cardio",
    maxMinutes: WEEKDAY_CAP,
    options: [
      {
        key: "erg",
        label: "Rower or SkiErg",
        locations: ["indoor"],
        sports: ["Rowing", "SkiErg"],
        format: "steady",
        minutes: 50,
        hr: HR_STEADY,
      },
      {
        key: "outdoor",
        label: "Run, swim or ski",
        locations: ["outdoor"],
        sports: ["Running", "Swimming", "XC ski"],
        format: "steady",
        minutes: 50,
        hr: HR_STEADY,
      },
      {
        key: "travel",
        label: "Easy run",
        locations: ["travel"],
        sports: ["Running"],
        format: "steady",
        minutes: 40,
        hr: HR_STEADY,
      },
    ],
  },
  {
    weekday: 3,
    short: "Wed",
    long: "Wednesday",
    focus: "Intensity",
    kind: "intensity",
    maxMinutes: WEEKDAY_CAP,
    options: [
      {
        key: "erg",
        label: "Rower or SkiErg",
        locations: ["indoor"],
        sports: ["Rowing", "SkiErg"],
        format: "intervals",
        warmup: 10,
        sets: 4,
        work: "4 min hard",
        workMinutes: 4,
        recovery: "3 min easy",
        recoveryMinutes: 3,
        cooldown: 10,
      },
      {
        key: "tennis",
        label: "Tennis",
        locations: ["outdoor"],
        sports: ["Tennis"],
        format: "play",
        minutes: 60,
        style: "Match play",
      },
      {
        key: "rope",
        label: "Rope jumping",
        locations: ["indoor", "outdoor"],
        sports: ["Rope jumping"],
        format: "intervals",
        warmup: 8,
        sets: 8,
        work: "1 min",
        workMinutes: 1,
        recovery: "1 min easy",
        recoveryMinutes: 1,
        cooldown: 7,
      },
      {
        key: "travel",
        label: "Stair intervals",
        locations: ["travel"],
        sports: ["Stairs"],
        format: "intervals",
        warmup: 8,
        sets: 6,
        work: "2 min hard",
        workMinutes: 2,
        recovery: "2 min walk down",
        recoveryMinutes: 2,
        cooldown: 7,
      },
    ],
  },
  {
    weekday: 4,
    short: "Thu",
    long: "Thursday",
    focus: "Strength",
    kind: "strength",
    options: [
      {
        key: "kettlebell",
        label: "Kettlebell & band",
        locations: ["indoor", "outdoor"],
        sports: ["Kettlebell", "Band", "Bodyweight"],
        format: "sets",
        sets: STRENGTH_SETS,
        reps: STRENGTH_REPS,
        restSets: REST_SETS,
        restExercises: REST_EXERCISES,
        exercises: [
          { name: "Kettlebell deadlift", reps: "15" },
          { name: "Band pulldown", reps: "15" },
          { name: "Single-leg RDL", reps: "15 / leg" },
          { name: "Overhead press", reps: "15" },
          { name: "Plank shoulder tap", reps: "45 s" },
        ],
      },
      {
        key: "travel",
        label: "Bodyweight",
        locations: ["travel"],
        sports: ["Bodyweight"],
        format: "sets",
        sets: STRENGTH_SETS,
        reps: STRENGTH_REPS,
        restSets: REST_SETS,
        restExercises: REST_EXERCISES,
        exercises: [
          { name: "Glute bridge", reps: "15" },
          { name: "Towel row on door", reps: "15" },
          { name: "Reverse lunge", reps: "15 / leg" },
          { name: "Forearm plank", reps: "60 s" },
          { name: "Side plank", reps: "40 s / side" },
        ],
      },
    ],
  },
  {
    weekday: 5,
    short: "Fri",
    long: "Friday",
    focus: "Rest",
    kind: "rest",
    options: [],
  },
  {
    weekday: 6,
    short: "Sat",
    long: "Saturday",
    focus: "Long session",
    kind: "long",
    minMinutes: LONG_DAY_FLOOR,
    // outdoor only — a treadmill is not an option for the long day
    options: [
      {
        key: "outdoor",
        label: "Run, ride or ski",
        locations: ["outdoor"],
        sports: ["Running", "Cycling", "XC ski"],
        format: "steady",
        minutes: 150,
        hr: HR_STEADY,
      },
    ],
  },
  {
    weekday: 7,
    short: "Sun",
    long: "Sunday",
    focus: "Recovery",
    kind: "recovery",
    options: [
      {
        key: "any",
        label: "Cycling or hiking",
        locations: ["outdoor"],
        sports: ["Hiking", "Cycling"],
        format: "steady",
        minutes: 70,
        hr: HR_EASY,
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Date helpers — all local time                                       */
/* ------------------------------------------------------------------ */

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** ISO weekday: 1 = Monday … 7 = Sunday */
export function isoWeekday(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1;
}

export function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -(isoWeekday(date) - 1));
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

export const PLAN_END = addDays(PLAN_START, PLAN_WEEK_COUNT * 7 - 1);

/* ------------------------------------------------------------------ */
/* Scheduling                                                          */
/* ------------------------------------------------------------------ */

export interface ScaledOption {
  key: string;
  label: string;
  locations: Location[];
  sports: string[];
  format: Format;
  /** sets */
  sets?: number;
  reps?: string;
  restSets?: string;
  restExercises?: string;
  exercises?: Exercise[];
  /** steady, play, intervals total */
  minutes?: number;
  hr?: string;
  style?: string;
  /** intervals */
  warmup?: number;
  work?: string;
  recovery?: string;
  cooldown?: number;
}

export type PlanStatus = "before" | "active" | "after";

export interface PlanDay {
  date: Date;
  weekday: number;
  template: DayTemplate;
  status: PlanStatus;
  week: PlanWeek | null;
  /** empty on the rest day and outside the plan */
  options: ScaledOption[];
}

function round5(minutes: number): number {
  return Math.max(5, Math.round(minutes / 5) * 5);
}

function clamp(minutes: number, limits: { min?: number; max?: number }): number {
  let value = minutes;
  if (limits.min) value = Math.max(value, limits.min);
  if (limits.max) value = Math.min(value, limits.max);
  return value;
}

function scaleOption(
  option: OptionTemplate,
  volume: number,
  limits: { min?: number; max?: number },
): ScaledOption {
  const base = {
    key: option.key,
    label: option.label,
    locations: option.locations,
    sports: option.sports,
    format: option.format,
  };

  if (option.format === "sets") {
    // fixed prescription — strength progresses by load, not by volume
    return {
      ...base,
      sets: option.sets,
      reps: option.reps,
      restSets: option.restSets,
      restExercises: option.restExercises,
      exercises: option.exercises,
    };
  }

  if (option.format === "intervals") {
    const sets = Math.max(2, Math.round((option.sets ?? 4) * volume));
    const total =
      (option.warmup ?? 0) +
      sets * ((option.workMinutes ?? 0) + (option.recoveryMinutes ?? 0)) +
      (option.cooldown ?? 0);
    return {
      ...base,
      warmup: option.warmup,
      sets,
      work: option.work,
      recovery: option.recovery,
      cooldown: option.cooldown,
      minutes: clamp(total, limits),
    };
  }

  // steady and play both scale on minutes
  return {
    ...base,
    minutes: clamp(round5((option.minutes ?? 0) * volume), limits),
    hr: option.hr,
    style: option.style,
  };
}

export function getTemplate(date: Date): DayTemplate {
  return DAY_TEMPLATES[isoWeekday(date) - 1];
}

/** 1-based plan week for a date, or null outside the plan. */
export function getWeekNumber(date: Date): number | null {
  const offset = daysBetween(PLAN_START, date);
  if (offset < 0) return null;
  const week = Math.floor(offset / 7) + 1;
  return week > PLAN_WEEK_COUNT ? null : week;
}

export function getPlanDay(date: Date): PlanDay {
  const template = getTemplate(date);
  const weekNumber = getWeekNumber(date);
  const status: PlanStatus =
    weekNumber !== null ? "active" : daysBetween(PLAN_START, date) < 0 ? "before" : "after";

  if (weekNumber === null) {
    return { date, weekday: template.weekday, template, status, week: null, options: [] };
  }

  const week = PLAN_WEEKS[weekNumber - 1];
  const limits = { min: template.minMinutes, max: template.maxMinutes };

  return {
    date,
    weekday: template.weekday,
    template,
    status,
    week,
    options: template.options.map((o) => scaleOption(o, week.volume, limits)),
  };
}

export function weekStartDate(week: number): Date {
  return addDays(PLAN_START, (week - 1) * 7);
}

/** Every day of one plan week, Monday first. */
export function weekDays(week: number): PlanDay[] {
  const start = weekStartDate(week);
  return Array.from({ length: 7 }, (_, i) => getPlanDay(addDays(start, i)));
}

/** What a day offers at one location — the list shown under that tab. */
export function optionsForLocation(day: PlanDay, location: Location): ScaledOption[] {
  return day.options.filter((option) => option.locations.includes(location));
}

export interface LocationGroup {
  /** the location a click on this button selects */
  key: Location;
  label: string;
  /** every location the button stands for */
  locations: Location[];
}

/**
 * The buttons one day actually needs.
 *
 * Locations with nothing scheduled get no button at all, and where indoor and
 * outdoor come to the same work — kettlebells are kettlebells in the living
 * room or the garden — the two collapse into a single "Home". Only days where
 * the choice changes the session, like rower against a run, spend two buttons
 * on it.
 */
export function locationGroups(day: PlanDay): LocationGroup[] {
  const label = (key: Location) => LOCATIONS.find((l) => l.key === key)!.label;
  const signature = (key: Location) =>
    optionsForLocation(day, key)
      .map((option) => option.key)
      .join("|");

  const indoor = signature("indoor");
  const outdoor = signature("outdoor");
  const groups: LocationGroup[] = [];

  if (indoor && indoor === outdoor) {
    groups.push({ key: "indoor", label: "Home", locations: ["indoor", "outdoor"] });
  } else {
    if (indoor) groups.push({ key: "indoor", label: label("indoor"), locations: ["indoor"] });
    if (outdoor) groups.push({ key: "outdoor", label: label("outdoor"), locations: ["outdoor"] });
  }

  if (signature("travel")) {
    groups.push({ key: "travel", label: label("travel"), locations: ["travel"] });
  }

  return groups;
}

/** Stable key for a date — also the DOM id the agenda scrolls to. */
export function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m.toString().padStart(2, "0")}`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatMonth(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDayLong(date: Date): string {
  return `${getTemplate(date).long} ${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
}

export function formatDayShort(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
}
