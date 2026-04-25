export type LiveSessionHubMode = "hub" | "transmit" | "monitor" | "full" | "videos";

export type LiveSessionRole = "transmitter" | "monitor" | "complete";

export type LiveSessionLifecycleState =
  | "no-session"
  | "preview-active"
  | "in-progress"
  | "paused"
  | "finished";

export type LiveSessionModules = {
  tableActive: boolean;
  transmissionActive: boolean;
};

export type LiveSessionSnapshot = {
  id: string;
  stageId: string | null;
  stageTitle: string;
  stageDateLabel: string;
  matchLabel: string;
  blindLabel: string;
  role: LiveSessionRole;
  state: LiveSessionLifecycleState;
  modules: LiveSessionModules;
  connectionStatus: string;
};

export function resolveLiveSessionLifecycleState({
  captureStatus,
  sessionStatus,
  hasFinishedSession,
}: {
  captureStatus: "idle" | "preview";
  sessionStatus: "idle" | "running" | "paused";
  hasFinishedSession: boolean;
}): LiveSessionLifecycleState {
  if (sessionStatus === "running") {
    return "in-progress";
  }

  if (sessionStatus === "paused") {
    return "paused";
  }

  if (captureStatus === "preview") {
    return "preview-active";
  }

  if (hasFinishedSession) {
    return "finished";
  }

  return "no-session";
}

export function formatLiveSessionLifecycleState(
  state: LiveSessionLifecycleState,
): string {
  switch (state) {
    case "preview-active":
      return "preview ativo";
    case "in-progress":
      return "sessao em andamento";
    case "paused":
      return "sessao pausada";
    case "finished":
      return "sessao finalizada";
    default:
      return "sem sessao";
  }
}

