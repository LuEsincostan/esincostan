import { addDays, getPlanDay, isoWeekday, sameDay, startOfWeek } from "../../data/training-plan";

interface Props {
  /** Any date inside the month to render. */
  cursor: Date;
  today: Date;
  selected: Date;
  onSelectDay: (date: Date) => void;
}

const WEEKDAY_HEADS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthGrid({ cursor, today, selected, onSelectDay }: Props) {
  const month = cursor.getMonth();
  const first = new Date(cursor.getFullYear(), month, 1);
  const last = new Date(cursor.getFullYear(), month + 1, 0);

  // pad to whole Monday-start weeks so the grid stays rectangular
  const gridStart = startOfWeek(first);
  const cellCount =
    Math.round((addDays(last, 7 - isoWeekday(last)).getTime() - gridStart.getTime()) / 86_400_000) + 1;
  const cells = Array.from({ length: cellCount }, (_, i) => addDays(gridStart, i));

  return (
    <div class="tp-month">
      <div class="tp-month-heads">
        {WEEKDAY_HEADS.map((name) => (
          <span class="tp-month-head" key={name}>
            {name}
          </span>
        ))}
      </div>

      <div class="tp-month-grid">
        {cells.map((date) => {
          const day = getPlanDay(date);
          const outside = day.status !== "active";

          return (
            <button
              type="button"
              key={date.toISOString()}
              class={[
                "tp-cell",
                `tp-kind-${day.template.kind}`,
                date.getMonth() === month ? "" : "is-othermonth",
                outside ? "is-outside" : "",
                sameDay(date, today) ? "is-today" : "",
                sameDay(date, selected) ? "is-selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectDay(date)}
              aria-label={`${date.getDate()} — ${day.template.focus}`}
            >
              <span class="tp-cell-date">{date.getDate()}</span>
              {!outside && (
                <>
                  <span class="tp-cell-dot" aria-hidden="true" />
                  <span class="tp-cell-focus">{day.template.focus}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
