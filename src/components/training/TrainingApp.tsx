import { useEffect, useMemo, useState } from "preact/hooks";
import {
  DAY_TEMPLATES,
  PLAN_END,
  PLAN_START,
  PLAN_WEEK_COUNT,
  addDays,
  daysBetween,
  formatDayLong,
  formatDayShort,
  formatMonth,
  getPlanDay,
  getWeekNumber,
  startOfDay,
  startOfWeek,
  weekStartDate,
} from "../../data/training-plan";
import { SessionDetail } from "./SessionDetail";
import { WeekView } from "./WeekView";
import { MonthGrid } from "./MonthGrid";
import { PlanProgress } from "./PlanProgress";

type View = "month" | "week" | "day";

const VIEWS: { key: View; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "day", label: "Day" },
];

/**
 * Where the calendar opens. Today can sit outside the plan window, and an
 * empty week is a useless landing view, so the calendar clamps into the plan
 * while the card above still reports the real date.
 */
function initialCursor(today: Date): Date {
  if (daysBetween(PLAN_START, today) < 0) return PLAN_START;
  if (daysBetween(today, PLAN_END) < 0) return PLAN_END;
  return today;
}

export function TrainingApp() {
  // seeded at build time, corrected on mount — a static page must not ship a
  // frozen "today"
  const [now, setNow] = useState(() => startOfDay(new Date()));
  const [cursor, setCursor] = useState(() => initialCursor(startOfDay(new Date())));
  const [view, setView] = useState<View>("week");

  useEffect(() => {
    const real = startOfDay(new Date());
    setNow(real);
    setCursor(initialCursor(real));
  }, []);

  const cursorPlan = useMemo(() => getPlanDay(cursor), [cursor]);
  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);
  const cursorWeek = getWeekNumber(cursor);

  function step(delta: number) {
    if (view === "month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    else if (view === "week") setCursor(addDays(cursor, delta * 7));
    else setCursor(addDays(cursor, delta));
  }

  function selectDay(date: Date) {
    setCursor(date);
    setView("day");
  }

  const rangeLabel =
    view === "month"
      ? formatMonth(cursor)
      : view === "week"
        ? `${formatDayShort(weekStart)} – ${formatDayShort(addDays(weekStart, 6))}`
        : formatDayLong(cursor);

  const weekLabel = view === "week" ? getWeekNumber(weekStart) : cursorWeek;

  return (
    <div class="tp">
      <section class="tp-section tp-section--today">
        {/* the page's h1 — no hero, this opens the page */}
        <h1 class="tp-section-label">Today</h1>
        <TodayPanel today={now} />
      </section>

      <section class="tp-section">
        <PlanProgress
          activeWeek={cursorWeek}
          onSelectWeek={(week) => {
            setCursor(weekStartDate(week));
            setView("week");
          }}
        />
      </section>

      <section class="tp-section">
        <div class="tp-calendar-bar">
          <div class="tp-views">
            {VIEWS.map((v) => (
              <button
                type="button"
                key={v.key}
                class={`tp-view-btn ${view === v.key ? "is-active" : ""}`}
                onClick={() => setView(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div class="tp-range">
            <span class="tp-range-label">{rangeLabel}</span>
            {weekLabel !== null && (
              <span class="tp-range-week">
                Week {weekLabel}/{PLAN_WEEK_COUNT}
              </span>
            )}
          </div>

          <div class="tp-nav">
            <button type="button" class="tp-nav-btn" onClick={() => step(-1)} aria-label="Previous">
              &larr;
            </button>
            <button type="button" class="tp-nav-btn tp-nav-today" onClick={() => setCursor(now)}>
              Today
            </button>
            <button type="button" class="tp-nav-btn" onClick={() => step(1)} aria-label="Next">
              &rarr;
            </button>
          </div>
        </div>

        {view === "month" && (
          <MonthGrid cursor={cursor} today={now} selected={cursor} onSelectDay={selectDay} />
        )}
        {view === "week" && <WeekView weekStart={weekStart} today={now} onSelectDay={selectDay} />}
        {view === "day" && <SessionDetail day={cursorPlan} tone="day" />}

        <Legend />
      </section>
    </div>
  );
}

function TodayPanel({ today }: { today: Date }) {
  const plan = getPlanDay(today);

  if (plan.status === "before") {
    const days = daysBetween(today, PLAN_START);
    return (
      <>
        <p class="tp-countdown">
          <strong>{days}</strong> {days === 1 ? "day" : "days"} until week 1 &middot;{" "}
          {formatDayShort(PLAN_START)}
        </p>
        <SessionDetail day={getPlanDay(PLAN_START)} tone="today" eyebrow="Day 1 · Mon 10 Aug" />
      </>
    );
  }

  if (plan.status === "after") {
    return <p class="tp-countdown">Plan complete.</p>;
  }

  return <SessionDetail day={plan} tone="today" />;
}

function Legend() {
  return (
    <div class="tp-legend">
      {DAY_TEMPLATES.map((day) => (
        <span class={`tp-legend-item tp-kind-${day.kind}`} key={day.short}>
          <span class="tp-legend-dot" />
          {day.short}
        </span>
      ))}
    </div>
  );
}
