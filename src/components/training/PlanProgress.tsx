import { PLAN_WEEKS } from "../../data/training-plan";

interface Props {
  /** 1-based week currently in view, or null when outside the plan. */
  activeWeek: number | null;
  onSelectWeek: (week: number) => void;
}

const MIN_VOLUME = 0.6;
const MAX_VOLUME = 1.35;

export function PlanProgress({ activeWeek, onSelectWeek }: Props) {
  return (
    <div class="tp-progress">
      {PLAN_WEEKS.map((week) => (
        <button
          type="button"
          key={week.week}
          class={[
            "tp-progress-week",
            `tp-phase--${week.phase.toLowerCase()}`,
            activeWeek === week.week ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onSelectWeek(week.week)}
          title={`Week ${week.week} · ${week.block} · ${week.phase}`}
        >
          <span class="tp-progress-bar-track">
            <span
              class="tp-progress-bar"
              style={{
                height: `${((week.volume - MIN_VOLUME) / (MAX_VOLUME - MIN_VOLUME)) * 100}%`,
              }}
            />
          </span>
          <span class="tp-progress-num">{week.week}</span>
        </button>
      ))}
    </div>
  );
}
