import { useEffect, useRef, useState } from "preact/hooks";
import {
  PLAN_END,
  PLAN_START,
  PLAN_WEEKS,
  dayKey,
  daysBetween,
  formatDayShort,
  getWeekNumber,
  sameDay,
  startOfDay,
  weekDays,
  type Location,
} from "../../data/training-plan";
import { DayRow } from "./DayRow";
import { PlanProgress } from "./PlanProgress";

/**
 * The plan reads as one vertical scroll: twelve week blocks, seven days each,
 * with the current day open where you land. There is no month grid and no
 * view switcher — a training plan is a list you work down, not a calendar you
 * navigate.
 */

/** Where the agenda opens. Today can sit outside the twelve weeks. */
function focusDate(today: Date): Date {
  if (daysBetween(PLAN_START, today) < 0) return PLAN_START;
  if (daysBetween(today, PLAN_END) < 0) return PLAN_END;
  return today;
}

export function TrainingApp() {
  // Seeded with day 1 and corrected on mount. These initialisers must NOT read
  // the clock: the hydration render would then disagree with the prerendered
  // markup, and preact's hydrate reuses matched DOM without patching its
  // attributes — the is-open and is-today classes would stick to day 1 for the
  // life of the page even as the right body opened underneath them. Seeding a
  // constant keeps hydration identical to the HTML, so the effect below lands
  // as an ordinary diff that does update the DOM.
  const [now, setNow] = useState(PLAN_START);
  const [openDate, setOpenDate] = useState<Date | null>(PLAN_START);
  // shared by every day: choose "Travelling" once and the whole plan follows
  const [location, setLocation] = useState<Location>("indoor");

  useEffect(() => {
    const real = startOfDay(new Date());
    const focus = focusDate(real);
    setNow(real);
    setOpenDate(focus);

    // day 1 already sits at the top of the page — only scroll when it is not
    if (sameDay(focus, PLAN_START)) return;
    const frame = requestAnimationFrame(() => scrollTo(`day-${dayKey(focus)}`, "center"));
    return () => cancelAnimationFrame(frame);
  }, []);

  // The pinned bar covers the top of the viewport, so scroll targets need a
  // matching scroll-margin or they land underneath it. Measure rather than
  // hardcode — the bar is a different height on a phone than on a desktop.
  const pinnedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = pinnedRef.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty("--tp-pinned-h", `${el.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const activeWeek = openDate ? getWeekNumber(openDate) : null;

  function jumpToToday() {
    const focus = focusDate(now);
    setOpenDate(focus);
    scrollTo(`day-${dayKey(focus)}`, "center", true);
  }

  return (
    <div class="tp">
      {/* Pinned: the title, the Today button and the twelve-week bar stay put
          while the agenda scrolls under them, so jumping between weeks never
          scrolls the controls off the screen. */}
      <div class="tp-pinned" ref={pinnedRef}>
        <header class="tp-head">
          <div class="tp-head-row">
            <h1 class="tp-title">Training</h1>
            <button type="button" class="tp-jump" onClick={jumpToToday}>
              Today
            </button>
          </div>
        </header>

        <PlanProgress
          activeWeek={activeWeek}
          onSelectWeek={(week) => scrollTo(`week-${week}`, "start", true)}
        />
      </div>

      <div class="tp-agenda">
        {PLAN_WEEKS.map((week) => {
          const days = weekDays(week.week);

          return (
            <section class="tp-block" id={`week-${week.week}`} key={week.week}>
              <header class="tp-block-head">
                <span class="tp-block-week">Week {week.week}</span>
                <span class="tp-block-name">{week.block}</span>
                <span class={`tp-phase tp-phase--${week.phase.toLowerCase()}`}>{week.phase}</span>
                <span class="tp-block-range">
                  {formatDayShort(days[0].date)} &ndash; {formatDayShort(days[6].date)}
                </span>
              </header>

              {days.map((day) => (
                <DayRow
                  key={dayKey(day.date)}
                  day={day}
                  isToday={sameDay(day.date, now)}
                  expanded={openDate !== null && sameDay(day.date, openDate)}
                  onToggle={() =>
                    setOpenDate(openDate !== null && sameDay(day.date, openDate) ? null : day.date)
                  }
                  location={location}
                  onLocation={setLocation}
                />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function scrollTo(id: string, block: ScrollLogicalPosition, smooth = false) {
  document.getElementById(id)?.scrollIntoView({ block, behavior: smooth ? "smooth" : "auto" });
}
