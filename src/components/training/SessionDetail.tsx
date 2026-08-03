import { useState } from "preact/hooks";
import {
  PLAN_WEEK_COUNT,
  formatDayLong,
  formatDuration,
  type PlanDay,
  type ScaledOption,
} from "../../data/training-plan";

interface Props {
  day: PlanDay;
  tone: "today" | "day";
  eyebrow?: string;
}

export function SessionDetail({ day, tone, eyebrow }: Props) {
  const { template, week, options, status } = day;
  const [tab, setTab] = useState(0);

  // the day can change under a reused component — never index past the end
  const active = Math.min(tab, Math.max(0, options.length - 1));

  return (
    <article class={`tp-detail tp-detail--${tone} tp-kind-${template.kind}`}>
      <header class="tp-detail-head">
        <div class="tp-detail-headings">
          <p class="tp-detail-eyebrow">
            {eyebrow ?? (tone === "today" ? "Today" : formatDayLong(day.date))}
          </p>
          <h3 class="tp-detail-title">{template.focus}</h3>
        </div>
        {week && (
          <div class="tp-detail-meta">
            <span class="tp-week-badge">
              Week {week.week}
              <span class="tp-week-badge-of">/{PLAN_WEEK_COUNT}</span>
            </span>
            <span class={`tp-phase tp-phase--${week.phase.toLowerCase()}`}>{week.phase}</span>
          </div>
        )}
      </header>

      {status !== "active" ? (
        <p class="tp-notice">Outside the plan.</p>
      ) : options.length === 0 ? (
        <p class="tp-notice tp-notice--rest">Rest day.</p>
      ) : (
        <>
          {options.length > 1 && (
            <div class="tp-tabs" role="tablist">
              {options.map((option, i) => (
                <button
                  type="button"
                  key={option.key}
                  role="tab"
                  aria-selected={i === active}
                  class={`tp-tab ${i === active ? "is-active" : ""}`}
                  onClick={() => setTab(i)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          <div class="tp-panels">
            {options.map((option, i) => (
              <section
                key={option.key}
                role="tabpanel"
                class={`tp-panel ${i === active ? "is-active" : ""}`}
              >
                <p class="tp-panel-label">{option.label}</p>
                <OptionBody option={option} />
              </section>
            ))}
          </div>
        </>
      )}
    </article>
  );
}

function OptionBody({ option }: { option: ScaledOption }) {
  return (
    <>
      <ul class="tp-sports">
        {option.sports.map((sport) => (
          <li class="tp-sport" key={sport}>
            {sport}
          </li>
        ))}
      </ul>

      {option.format === "sets" && (
        <>
          <p class="tp-headline">
            <strong>
              {option.sets} &times; {option.reps}
            </strong>
            <span class="tp-headline-sub">{option.restSets} rest between sets</span>
          </p>
          <p class="tp-meta-line">
            Straight sets &middot; {option.restExercises} between exercises
          </p>
          <ul class="tp-exercises">
            {option.exercises?.map((exercise) => (
              <li class="tp-exercise" key={exercise.name}>
                <span class="tp-exercise-name">{exercise.name}</span>
                <span class="tp-exercise-reps">{exercise.reps}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {option.format === "steady" && (
        <p class="tp-headline">
          <strong>{formatDuration(option.minutes ?? 0)}</strong>
          <span class="tp-headline-sub">{option.hr}</span>
        </p>
      )}

      {option.format === "play" && (
        <p class="tp-headline">
          <strong>{formatDuration(option.minutes ?? 0)}</strong>
          <span class="tp-headline-sub">{option.style}</span>
        </p>
      )}

      {option.format === "intervals" && (
        <>
          <p class="tp-headline">
            <strong>
              {option.sets} &times; {option.work}
            </strong>
            <span class="tp-headline-sub">{option.recovery}</span>
          </p>
          <ul class="tp-exercises">
            <li class="tp-exercise">
              <span class="tp-exercise-name">Warm-up</span>
              <span class="tp-exercise-reps">{option.warmup} min</span>
            </li>
            <li class="tp-exercise">
              <span class="tp-exercise-name">Cool-down</span>
              <span class="tp-exercise-reps">{option.cooldown} min</span>
            </li>
            <li class="tp-exercise tp-exercise--total">
              <span class="tp-exercise-name">Total</span>
              <span class="tp-exercise-reps">{formatDuration(option.minutes ?? 0)}</span>
            </li>
          </ul>
        </>
      )}

      {option.equipment && <p class="tp-equipment">{option.equipment}</p>}
    </>
  );
}
