import { useState, useEffect, useRef } from "preact/hooks";
import type { UserState } from "../../data/types";
import { loadFromSheets, saveToSheets } from "./google-sheets";

// Replace with your Google Cloud OAuth Client ID
const GOOGLE_CLIENT_ID = "270751188073-o085fj5mk44a4jit3femnhqvbln85e8a.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file";

interface Props {
  userState: UserState;
  onImport: (state: UserState) => void;
}

export function StateManager({ userState, onImport }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"" | "saved" | "error" | "loading">("");
  const tokenClientRef = useRef<any>(null);
  const saveTimeoutRef = useRef<any>(null);
  const lastSavedRef = useRef<string>("");

  // Initialize Google token client
  useEffect(() => {
    const initClient = () => {
      if (!(window as any).google?.accounts?.oauth2) {
        setTimeout(initClient, 200);
        return;
      }
      tokenClientRef.current = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: handleTokenResponse,
      });
    };
    initClient();
  }, []);

  const handleTokenResponse = async (response: any) => {
    if (response.error) return;
    const accessToken = response.access_token;
    setToken(accessToken);

    // Get user info
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const info = await res.json();
      setUserName(info.name || info.email || "Connected");
    } catch {}

    // Load state from Sheets
    setStatus("loading");
    const remote = await loadFromSheets(accessToken);
    if (remote) {
      onImport(remote);
    }
    setStatus("");
  };

  const handleSignIn = () => {
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken();
    }
  };

  const handleSignOut = () => {
    if (token) {
      (window as any).google?.accounts?.oauth2?.revoke?.(token);
    }
    setToken(null);
    setUserName(null);
    setStatus("");
  };

  // Auto-save to Sheets on state changes (debounced)
  useEffect(() => {
    if (!token) return;

    const stateJson = JSON.stringify(userState);
    if (stateJson === lastSavedRef.current) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      const ok = await saveToSheets(token, userState);
      setSaving(false);
      if (ok) {
        lastSavedRef.current = stateJson;
        setStatus("saved");
        setTimeout(() => setStatus(""), 2000);
      } else {
        setStatus("error");
      }
    }, 1500);
  }, [userState, token]);

  // Export/Import for backup
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
        } catch {}
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const isConfigured = GOOGLE_CLIENT_ID !== "YOUR_CLIENT_ID.apps.googleusercontent.com";

  return (
    <div class="state-manager-wrap">
      {token && (
        <div class="sync-status">
          <span class="sync-user">{userName}</span>
          {saving && <span class="sync-indicator">Saving...</span>}
          {status === "saved" && <span class="sync-indicator sync-ok">Saved to Google Sheets</span>}
          {status === "error" && <span class="sync-indicator sync-err">Save failed</span>}
          {status === "loading" && <span class="sync-indicator">Loading...</span>}
        </div>
      )}
      <div class="state-manager">
        {isConfigured && !token && (
          <button class="btn-sm btn-google" onClick={handleSignIn}>
            Sign in with Google
          </button>
        )}
        {token && (
          <button class="btn-sm" onClick={handleSignOut}>
            Sign out
          </button>
        )}
        <button class="btn-sm" onClick={handleExport}>Export</button>
        <button class="btn-sm" onClick={handleImport}>Import</button>
      </div>
    </div>
  );
}
