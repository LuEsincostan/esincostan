import {
  dayKey,
  locationGroups,
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
  const groups = locationGroups(day);
  // Fall back to the first button this day actually has. The chosen location is
  // shared down the whole agenda, so it will often name somewhere a given day
  // does not go — Saturday is outdoors only — and a card must never open blank.
  const shown = groups.find((group) => group.locations.includes(location)) ?? groups[0];
  const options = shown ? optionsForLocation(day, shown.key) : [];
  const id = dayKey(day.date);

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

        {!rest && <span class="tp-day-chevron" aria-hidden="true" />}
      </button>

      {expanded && !rest && (
        <div class="tp-day-body" id={`body-${id}`}>
          <div class="tp-tabs" role="tablist" aria-label="Where are you training?">
            {groups.map((group) => {
              const active = group === shown;
              return (
                <button
                  type="button"
                  key={group.key}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${id}`}
                  class={`tp-tab ${active ? "is-active" : ""}`}
                  // already inside this group — don't shuffle the shared choice
                  onClick={() => !active && onLocation(group.key)}
                >
                  {group.label}
                </button>
              );
            })}
          </div>

          <ul class="tp-options" id={`panel-${id}`} role="tabpanel">
            {options.map((option) => (
              <li class="tp-option" key={option.key}>
                <p class="tp-option-label">{option.label}</p>
                <OptionBody option={option} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
