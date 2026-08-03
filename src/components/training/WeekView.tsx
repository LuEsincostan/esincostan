import { addDays, getPlanDay, optionSummary, sameDay } from "../../data/training-plan";

interface Props {
  /** Monday of the week being shown. */
  weekStart: Date;
  today: Date;
  onSelectDay: (date: Date) => void;
}

export function WeekView({ weekStart, today, onSelectDay }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => getPlanDay(addDays(weekStart, i)));

  return (
    <div class="tp-week">
      {days.map((day) => {
        const outside = day.status !== "active";

        return (
          <button
            type="button"
            key={day.date.toISOString()}
            class={[
              "tp-week-day",
              `tp-kind-${day.template.kind}`,
              sameDay(day.date, today) ? "is-today" : "",
              outside ? "is-outside" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onSelectDay(day.date)}
          >
            <span class="tp-week-day-name">{day.template.short}</span>
            <span class="tp-week-day-date">{day.date.getDate()}</span>
            <span class="tp-week-day-focus">{day.template.focus}</span>

            {!outside && day.options.length > 0 && (
              <ul class="tp-week-day-options">
                {day.options.map((option) => (
                  <li class="tp-week-option" key={option.key}>
                    <span class="tp-week-option-label">{option.label}</span>
                    <span class="tp-week-option-value">{optionSummary(option)}</span>
                  </li>
                ))}
              </ul>
            )}
          </button>
        );
      })}
    </div>
  );
}
