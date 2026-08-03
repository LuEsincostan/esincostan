import {
  LOCATIONS,
  dayKey,
  optionSummary,
  optionsForLocation,
  type Location,
  type PlanDay,
} from "../../data/training-plan";
import { OptionBody } from "./OptionBody";

interface Props {
  day: PlanDay;
  isToday: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** shared across the whole agenda — pick "Travelling" once and it stays */
  location: Location;
  onLocation: (location: Location) => void;
}

/**
 * One day in the agenda: a row you can open. Location is the only tabbed
 * choice; whatever that location offers is listed underneath, because a
 * second row of tabs would hide the very thing the list makes obvious.
 */
export function DayRow({ day, isToday, expanded, onToggle, location, onLocation }: Props) {
  const { template } = day;
  const rest = template.kind === "rest";
  const options = optionsForLocation(day, location);
  const id = dayKey(day.date);

  // the rest row already says "Rest" in its focus — no need to say it twice
  const summary = rest
    ? ""
    : options.length === 0
      ? "—"
      : options.length === 1
        ? optionSummary(options[0])
        : `${options.length} options`;

  return (
    <article
      id={`day-${id}`}
      class={[
        "tp-day",
        `tp-kind-${template.kind}`,
        isToday ? "is-today" : "",
        expanded ? "is-open" : "",
        rest ? "is-rest" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        class="tp-day-head"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`body-${id}`}
        disabled={rest}
      >
        <span class="tp-day-when">
          <span class="tp-day-name">{template.short}</span>
          <span class="tp-day-date">{day.date.getDate()}</span>
        </span>

        <span class="tp-day-focus">{template.focus}</span>
        {isToday && <span class="tp-day-today">Today</span>}

        {summary && <span class="tp-day-summary">{summary}</span>}
        {!rest && <span class="tp-day-chevron" aria-hidden="true" />}
      </button>

      {expanded && !rest && (
        <div class="tp-day-body" id={`body-${id}`}>
          <div class="tp-tabs" role="tablist" aria-label="Where are you training?">
            {LOCATIONS.map((entry) => {
              const stocked = optionsForLocation(day, entry.key).length > 0;
              return (
                <button
                  type="button"
                  key={entry.key}
                  role="tab"
                  aria-selected={entry.key === location}
                  aria-controls={`panel-${id}`}
                  class={[
                    "tp-tab",
                    entry.key === location ? "is-active" : "",
                    stocked ? "" : "is-empty",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => onLocation(entry.key)}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>

          {options.length === 0 ? (
            <p class="tp-notice" id={`panel-${id}`} role="tabpanel">
              {template.emptyNote ?? "Nothing scheduled here — try another location."}
            </p>
          ) : (
            <ul class="tp-options" id={`panel-${id}`} role="tabpanel">
              {options.map((option) => (
                <li class="tp-option" key={option.key}>
                  <p class="tp-option-label">{option.label}</p>
                  <OptionBody option={option} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}
