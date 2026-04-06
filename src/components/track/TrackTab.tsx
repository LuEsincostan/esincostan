import type { Lake, CompletedSwim } from "../../data/types";
import { SwissMap } from "./SwissMap";
import { TrackList } from "./TrackList";

interface Props {
  lakes: Lake[];
  selectedIds: string[];
  completedSwims: CompletedSwim[];
  goalCount: number;
  goalDeadline: string;
  onToggleComplete: (lakeId: string, date: string | null) => void;
}

export function TrackTab({
  lakes,
  selectedIds,
  completedSwims,
  goalCount,
  goalDeadline,
  onToggleComplete,
}: Props) {
  const completed = completedSwims.length;
  const pct = goalCount > 0 ? Math.round((completed / goalCount) * 100) : 0;
  const deadline = new Date(goalDeadline);
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <div class="tab-content">
      <div class="stats-bar">
        <div class="stat-card">
          <div class="stat-value">{completed}/{goalCount}</div>
          <div class="stat-label">Lakes Swum</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{pct}%</div>
          <div class="stat-label">Complete</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{daysLeft}</div>
          <div class="stat-label">Days Left</div>
        </div>
      </div>

      <div class="track-layout">
        <div class="track-map-container">
          <SwissMap lakes={lakes} selectedIds={selectedIds} completedSwims={completedSwims} />
        </div>

        <div>
          <h3 style={{ margin: "0 0 0.8rem", fontSize: "1rem", color: "var(--forest)" }}>
            Lake List
          </h3>
          <TrackList
            lakes={lakes}
            selectedIds={selectedIds}
            completedSwims={completedSwims}
            onToggleComplete={onToggleComplete}
          />
        </div>
      </div>
    </div>
  );
}
