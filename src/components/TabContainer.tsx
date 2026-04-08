import { useState, useEffect } from "preact/hooks";
import type { Lake, UserState } from "../data/types";
import { UnifiedMap } from "./track/UnifiedMap";
import { UnifiedList } from "./UnifiedList";
import { StateManager } from "./common/StateManager";

const STORAGE_KEY = "swiss-lakes-state";

interface Props {
  lakes: Lake[];
  initialUserState: UserState;
}

export function TabContainer({ lakes, initialUserState }: Props) {
  const [userState, setUserState] = useState<UserState>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (
            Array.isArray(parsed?.selectedLakeIds) &&
            Array.isArray(parsed?.completedSwims) &&
            typeof parsed?.goalCount === "number"
          ) {
            return parsed as UserState;
          }
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    return initialUserState;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userState));
    } catch {}
  }, [userState]);

  const completed = userState.completedSwims.length;
  const goal = userState.goalCount;
  const selected = userState.selectedLakeIds.length;
  const pct = goal > 0 ? Math.round((completed / goal) * 100) : 0;

  const deadline = new Date(userState.goalDeadline);
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const toggleLake = (id: string) => {
    setUserState((prev) => {
      const sel = prev.selectedLakeIds.includes(id)
        ? prev.selectedLakeIds.filter((lid) => lid !== id)
        : [...prev.selectedLakeIds, id];
      const swims = sel.includes(id)
        ? prev.completedSwims
        : prev.completedSwims.filter((s) => s.lakeId !== id);
      return { ...prev, selectedLakeIds: sel, completedSwims: swims };
    });
  };

  const toggleComplete = (lakeId: string, date: string | null) => {
    setUserState((prev) => {
      if (date === null) {
        return {
          ...prev,
          completedSwims: prev.completedSwims.filter((s) => s.lakeId !== lakeId),
        };
      }
      const existing = prev.completedSwims.find((s) => s.lakeId === lakeId);
      if (existing) {
        return {
          ...prev,
          completedSwims: prev.completedSwims.map((s) =>
            s.lakeId === lakeId ? { ...s, date } : s
          ),
        };
      }
      return {
        ...prev,
        completedSwims: [...prev.completedSwims, { lakeId, date }],
      };
    });
  };

  return (
    <div>
      <header class="site-header">
        <a href="/" class="back-link">&larr; esincostan</a>
        <h1>40 Lakes</h1>
        <p class="subtitle">Swim in 40 Swiss lakes by June 18, 2030</p>
        <div class="progress-summary">
          <span class="progress-stat"><strong>{completed}</strong> / {goal}</span>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span class="progress-stat">{pct}%</span>
        </div>
      </header>

      <div class="main-content">
        <div class="stats-bar">
          <div class="stat-card">
            <div class="stat-value">{completed}/{goal}</div>
            <div class="stat-label">Swum</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{selected}/{goal}</div>
            <div class="stat-label">Selected</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{daysLeft}</div>
            <div class="stat-label">Days Left</div>
          </div>
        </div>

        <div class="legend-bar">
          <span class="legend-item"><span class="legend-dot" style={{ background: "#ccc" }} /> Available</span>
          <span class="legend-item"><span class="legend-dot" style={{ background: "#2980b9" }} /> Selected</span>
          <span class="legend-item"><span class="legend-dot" style={{ background: "#27ae60" }} /> Completed</span>
        </div>

        <UnifiedMap
          lakes={lakes}
          selectedIds={userState.selectedLakeIds}
          completedSwims={userState.completedSwims}
          onToggleLake={toggleLake}
          onToggleComplete={toggleComplete}
        />

        <StateManager userState={userState} onImport={setUserState} />

        <UnifiedList
          lakes={lakes}
          selectedIds={userState.selectedLakeIds}
          completedSwims={userState.completedSwims}
          onToggleLake={toggleLake}
          onToggleComplete={toggleComplete}
        />
      </div>
    </div>
  );
}
