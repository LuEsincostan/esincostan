import type { UserState } from "../../data/types";

interface Props {
  userState: UserState;
  onImport: (state: UserState) => void;
}

export function StateManager({ userState, onImport }: Props) {
  const handleExport = () => {
    const json = JSON.stringify(userState, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user-state.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          if (parsed.selectedLakeIds && parsed.completedSwims) {
            onImport(parsed as UserState);
          }
        } catch {
          // Invalid JSON
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div class="state-manager">
      <button class="btn-sm" onClick={handleExport}>
        Export State
      </button>
      <button class="btn-sm" onClick={handleImport}>
        Import State
      </button>
    </div>
  );
}
