"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import {
  deleteSavedCardSample,
  getSavedCardSampleBlob,
  listSavedCardSamples,
  replaceSavedCardSampleBlob,
  saveCardSample,
  updateSavedCardSampleLabels,
  type SavedCardSampleSummary,
} from "@/lib/live-lab/browser-card-dataset-store";
import {
  deleteSavedHandClip,
  getSavedHandClipBlob,
  listSavedHandClips,
  saveHandClip,
  type SavedHandClipSummary,
} from "@/lib/live-lab/browser-video-store";
import {
  listSavedTranscripts,
  saveSessionTranscript,
  type SavedTranscriptSummary,
} from "@/lib/live-lab/browser-transcript-store";
import {
  drawBoardDetections,
  type BoardDetectionResult,
  type BoardStage,
  type BoardWorkerMessage,
} from "@/lib/live-lab/board-detection";
import {
  readLinkedStageContext,
  type LiveLinkedStageContext,
  type LiveLinkedStageOption,
} from "@/lib/live-lab/stage-runtime-link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type MediaDeviceOption = {
  deviceId: string;
  label: string;
};

type BoardRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CaptureStatus = "idle" | "preview";
type LiveLabView = "capture" | "admin" | "videos";
type LiveSessionStatus = "idle" | "running" | "paused";
type LiveLabMode = "lab" | "integrated";
type IntegratedDeviceRole = "camera" | "monitor";
type CommandKind = "start" | "end" | "save" | "none";
type TranscriptEntry = {
  id: string;
  at: string;
  text: string;
  command: CommandKind;
};
type BoardMonitorStatus = "idle" | "loading" | "monitoring";
type ActiveHandSession = {
  id: string;
  title: string;
  startedAt: number;
  startTrigger: string;
  transcriptLog: string[];
  markedForSave: boolean;
  mimeType: string;
  recorder: MediaRecorder;
  chunks: Blob[];
};
type PhotoCardImportBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type BoardCardClassifierPrediction = {
  rankGuess: string | null;
  suitGuess: string | null;
  rankConfidence: number | null;
  suitConfidence: number | null;
  combinedConfidence: number | null;
  rotation?: number | null;
  label: string | null;
};
type ExportedCardDatasetSample = {
  id: string;
  fileName: string;
  capturedAt: string;
  boardStage: BoardStage | "unknown";
  sourceImageName: string | null;
  sourceCardIndex: number;
  sourceCardCount: number;
  width: number;
  height: number;
  confidence: number | null;
  cornerConfidence: number | null;
  rankLabel: string;
  suitLabel: string;
  imageDataUrl: string;
};
type ExportedCardDatasetPayload = {
  version: 1;
  exportedAt: string;
  source: "shpl-live-lab";
  sampleCount: number;
  samples: ExportedCardDatasetSample[];
};
type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: {
      transcript: string;
    };
  }>;
};
type BrowserWindowWithSpeech = Window &
  typeof globalThis & {
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    SpeechRecognition?: new () => BrowserSpeechRecognition;
};

type LiveRemoteCommand =
  | "start-preview"
  | "stop-preview"
  | "start-session"
  | "pause-session"
  | "stop-session";

type LiveRemoteMessage =
  | {
      type: "viewer-ready";
      viewerId: string;
    }
  | {
      type: "state";
      deviceId: string;
      role: IntegratedDeviceRole;
      captureStatus: CaptureStatus;
      liveSessionStatus: LiveSessionStatus;
      error: string;
    }
  | {
      type: "command";
      fromId: string;
      command: LiveRemoteCommand;
    }
  | {
      type: "offer";
      fromId: string;
      toId: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: "answer";
      fromId: string;
      toId: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: "ice-candidate";
      fromId: string;
      toId: string;
      candidate: RTCIceCandidateInit;
    };

const STORAGE_KEY = "shpl-live-lab-settings";
const BOARD_REGION_STORAGE_KEY = "shpl-live-lab-board-region";
const INTEGRATED_DEVICE_ROLE_STORAGE_KEY = "shpl-live-lab-integrated-device-role";
const INTEGRATED_DEVICE_ID_STORAGE_KEY = "shpl-live-lab-integrated-device-id";
const LIVE_REMOTE_BROADCAST_EVENT = "live-remote";
const LIVE_REMOTE_CHANNEL_PREFIX = "shpl-live-remote";
const BOARD_MONITOR_IDLE_INTERVAL_MS = 1200;
const BOARD_MONITOR_ACTIVE_INTERVAL_MS = 800;
const BOARD_ANALYSIS_MAX_WIDTH = 420;
const BOARD_ANALYSIS_MAX_HEIGHT = 180;
const defaultBoardRegion: BoardRegion = {
  x: 22,
  y: 28,
  width: 56,
  height: 18,
};
const COMMAND_SAMPLE_DURATION_MS = 3500;
const CARD_RANK_OPTIONS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
const CARD_SUIT_OPTIONS = ["copas", "espadas", "ouros", "paus"];
const LIVE_REMOTE_ICE_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

type LiveLabPageProps = {
  mode?: LiveLabMode;
  linkedStageOption?: LiveLinkedStageOption | null;
};

export function LiveLabPage({ mode = "lab", linkedStageOption = null }: LiveLabPageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const adminVideoRef = useRef<HTMLVideoElement | null>(null);
  const supabaseClientRef = useRef<SupabaseClient | null>(null);
  const liveRemoteChannelRef = useRef<RealtimeChannel | null>(null);
  const livePeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remotePreviewStreamRef = useRef<MediaStream | null>(null);
  const liveRemoteDeviceIdRef = useRef("");
  const remoteViewerIdRef = useRef<string | null>(null);
  const snapshotCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardProcessingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const datasetImportInputRef = useRef<HTMLInputElement | null>(null);
  const datasetReplaceInputRef = useRef<HTMLInputElement | null>(null);
  const boardPreviewLoopIdRef = useRef(0);
  const boardWorkerRef = useRef<Worker | null>(null);
  const boardWorkerRequestIdRef = useRef(0);
  const boardWorkerPendingRef = useRef(
    new Map<
      number,
      {
        resolve: (detection: BoardDetectionResult) => void;
        reject: (error: Error) => void;
      }
    >(),
  );
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRecorderRef = useRef<MediaRecorder | null>(null);
  const commandRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const boardMonitorLoopIdRef = useRef(0);
  const isBoardDetectionRunningRef = useRef(false);
  const liveSessionStatusRef = useRef<LiveSessionStatus>("idle");
  const shouldKeepCommandRecognitionRef = useRef(false);
  const activeHandRef = useRef<ActiveHandSession | null>(null);
  const isFinalizingHandRef = useRef(false);
  const commandLoopIdRef = useRef(0);
  const handCounterRef = useRef(1);
  const sessionTranscriptStartedAtRef = useRef<string>("");
  const sessionTranscriptLinesRef = useRef<string[]>([]);
  const recentTranscriptSignaturesRef = useRef<Array<{ key: string; at: number }>>([]);
  const boardRegionRef = useRef<BoardRegion>(defaultBoardRegion);
  const latestBoardDetectionRef = useRef<BoardDetectionResult | null>(null);
  const hasAttemptedAutoPreviewRef = useRef(false);
  const hasHydratedSettingsRef = useRef(false);
  const startPreviewRef = useRef<null | (() => Promise<void>)>(null);
  const lastBoardSignatureRef = useRef<string>("");
  const lastBoardCardCountRef = useRef(0);
  const pendingLowerBoardDetectionRef = useRef<{ cardCount: number; streak: number } | null>(null);
  const pendingSameCountBoardDetectionRef = useRef<{
    signature: string;
    streak: number;
    detection: BoardDetectionResult;
  } | null>(null);
  const cardPredictionCacheRef = useRef<Map<string, BoardCardClassifierPrediction>>(new Map());
  const boardPredictionSignatureRef = useRef("");
  const boardPredictionRequestIdRef = useRef(0);

  const [videoDevices, setVideoDevices] = useState<MediaDeviceOption[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceOption[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState("");
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState("");
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>("idle");
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [error, setError] = useState("");
  const [boardRegion, setBoardRegion] = useState<BoardRegion>(defaultBoardRegion);
  const [boardMonitorStatus, setBoardMonitorStatus] = useState<BoardMonitorStatus>("idle");
  const [boardRuntimeLabel, setBoardRuntimeLabel] = useState("Worker do board ainda nao iniciado");
  const [boardDetection, setBoardDetection] = useState<BoardDetectionResult | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [transcriptError, setTranscriptError] = useState("");
  const [activeView, setActiveView] = useState<LiveLabView>("capture");
  const [liveSessionStatus, setLiveSessionStatus] = useState<LiveSessionStatus>("idle");
  const [deviceRole, setDeviceRole] = useState<IntegratedDeviceRole>(
    mode === "integrated" ? "monitor" : "camera",
  );
  const [remoteBridgeStatus, setRemoteBridgeStatus] = useState("Selecione o papel deste dispositivo.");
  const [transcriptFeed, setTranscriptFeed] = useState<TranscriptEntry[]>([]);
  const [activeHandTitle, setActiveHandTitle] = useState("");
  const [activeHandStartedAtIso, setActiveHandStartedAtIso] = useState("");
  const [savedVideos, setSavedVideos] = useState<SavedHandClipSummary[]>([]);
  const [isLoadingSavedVideos, setIsLoadingSavedVideos] = useState(true);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [selectedVideoUrl, setSelectedVideoUrl] = useState("");
  const [commandEngineLabel, setCommandEngineLabel] = useState("Aguardando sessao");
  const [savedTranscripts, setSavedTranscripts] = useState<SavedTranscriptSummary[]>([]);
  const [isLoadingSavedTranscripts, setIsLoadingSavedTranscripts] = useState(true);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState("");
  const [savedCardSamples, setSavedCardSamples] = useState<SavedCardSampleSummary[]>([]);
  const [isLoadingSavedCardSamples, setIsLoadingSavedCardSamples] = useState(true);
  const [isImportingCardPhotos, setIsImportingCardPhotos] = useState(false);
  const [isExportingCardDataset, setIsExportingCardDataset] = useState(false);
  const [cardDatasetStatus, setCardDatasetStatus] = useState("");
  const [selectedCardSampleId, setSelectedCardSampleId] = useState("");
  const [selectedCardSampleUrl, setSelectedCardSampleUrl] = useState("");
  const [selectedCardSampleBlobVersion, setSelectedCardSampleBlobVersion] = useState(0);
  const [hasSavedBoardRegion, setHasSavedBoardRegion] = useState(false);
  const [previewSessionId, setPreviewSessionId] = useState(0);
  const [linkedStageContext, setLinkedStageContext] = useState<LiveLinkedStageContext | null>(null);

  const integratedMode = mode === "integrated";
  const boardFeaturesEnabled = !integratedMode;
  const isRemoteMonitor = integratedMode && deviceRole === "monitor";
  const remoteChannelName = linkedStageOption
    ? `${LIVE_REMOTE_CHANNEL_PREFIX}:${linkedStageOption.stageId}`
    : null;

  function handleSelectCaptureMode() {
    setDeviceRole("camera");
    setActiveView("capture");
  }

  function handleSelectMonitorMode() {
    setDeviceRole("monitor");
    setActiveView("admin");
  }

  function handleEnableLocalCaptureFromAdmin() {
    setDeviceRole("camera");
    setActiveView("admin");
  }

  function attachPreviewStream(stream: MediaStream | null) {
    for (const element of [videoRef.current, adminVideoRef.current]) {
      if (!element) {
        continue;
      }

      element.srcObject = stream;
      if (stream) {
        void element.play().catch(() => undefined);
      }
    }
  }

  function clearRemotePreviewStream() {
    remotePreviewStreamRef.current?.getTracks().forEach((track) => track.stop());
    remotePreviewStreamRef.current = null;
    livePeerConnectionRef.current?.close();
    livePeerConnectionRef.current = null;
    remoteViewerIdRef.current = null;
    if (isRemoteMonitor) {
      attachPreviewStream(null);
    }
  }

  function getOrCreateIntegratedDeviceId() {
    if (liveRemoteDeviceIdRef.current) {
      return liveRemoteDeviceIdRef.current;
    }

    if (typeof window === "undefined") {
      return "";
    }

    const storedId = window.localStorage.getItem(INTEGRATED_DEVICE_ID_STORAGE_KEY);

    if (storedId) {
      liveRemoteDeviceIdRef.current = storedId;
      return storedId;
    }

    const nextId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `live-device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    window.localStorage.setItem(INTEGRATED_DEVICE_ID_STORAGE_KEY, nextId);
    liveRemoteDeviceIdRef.current = nextId;
    return nextId;
  }

  function getSupabaseClient() {
    if (supabaseClientRef.current) {
      return supabaseClientRef.current;
    }

    const client = createBrowserSupabaseClient();

    if (!client) {
      return null;
    }

    supabaseClientRef.current = client;
    return client;
  }

  async function sendLiveRemoteMessage(message: LiveRemoteMessage) {
    const channel = liveRemoteChannelRef.current;

    if (!channel) {
      return false;
    }

    const result = await channel.send({
      type: "broadcast",
      event: LIVE_REMOTE_BROADCAST_EVENT,
      payload: message,
    });

    return result === "ok";
  }

  async function broadcastIntegratedState(overrides?: Partial<Extract<LiveRemoteMessage, { type: "state" }>>) {
    if (!integratedMode || deviceRole !== "camera") {
      return;
    }

    const deviceId = getOrCreateIntegratedDeviceId();

    await sendLiveRemoteMessage({
      type: "state",
      deviceId,
      role: "camera",
      captureStatus: overrides?.captureStatus ?? captureStatus,
      liveSessionStatus: overrides?.liveSessionStatus ?? liveSessionStatus,
      error: overrides?.error ?? error,
    });
  }

  function buildRemoteStatusLabel(
    nextCaptureStatus: CaptureStatus,
    nextLiveSessionStatus: LiveSessionStatus,
  ) {
    if (nextCaptureStatus !== "preview") {
      return "Fonte conectada, mas preview ainda nao iniciado.";
    }

    if (nextLiveSessionStatus === "running") {
      return "Preview remoto ativo e sessao continua em andamento.";
    }

    if (nextLiveSessionStatus === "paused") {
      return "Preview remoto ativo e sessao continua pausada.";
    }

    return "Preview remoto ativo e pronto para controle.";
  }

  function ensureRemoteMediaStream() {
    if (remotePreviewStreamRef.current) {
      return remotePreviewStreamRef.current;
    }

    const stream = new MediaStream();
    remotePreviewStreamRef.current = stream;
    return stream;
  }

  function closeRemotePeerConnection() {
    livePeerConnectionRef.current?.close();
    livePeerConnectionRef.current = null;
    remoteViewerIdRef.current = null;
  }

  function resetRemotePreviewState() {
    clearRemotePreviewStream();
    setCaptureStatus("idle");
    setLiveSessionStatus("idle");
    liveSessionStatusRef.current = "idle";
  }

  async function announceViewerReady() {
    if (!integratedMode || deviceRole !== "monitor") {
      return;
    }

    const viewerId = getOrCreateIntegratedDeviceId();
    const sent = await sendLiveRemoteMessage({
      type: "viewer-ready",
      viewerId,
    });

    if (sent) {
      setRemoteBridgeStatus("Aguardando a fonte de captura responder com o preview remoto.");
    }
  }

  async function createOfferForViewer(viewerId: string) {
    if (!streamRef.current) {
      return;
    }

    closeRemotePeerConnection();

    const peerConnection = new RTCPeerConnection(LIVE_REMOTE_ICE_CONFIGURATION);
    livePeerConnectionRef.current = peerConnection;
    remoteViewerIdRef.current = viewerId;

    streamRef.current.getTracks().forEach((track) => {
      peerConnection.addTrack(track, streamRef.current as MediaStream);
    });

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      void sendLiveRemoteMessage({
        type: "ice-candidate",
        fromId: getOrCreateIntegratedDeviceId(),
        toId: viewerId,
        candidate: event.candidate.toJSON(),
      });
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === "connected") {
        setRemoteBridgeStatus("Fonte transmitindo preview remoto para o dispositivo monitor.");
      }

      if (peerConnection.connectionState === "failed") {
        setRemoteBridgeStatus("Falha ao transmitir o preview remoto. Tentando reconectar...");
      }
    };

    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    });
    await peerConnection.setLocalDescription(offer);

    await sendLiveRemoteMessage({
      type: "offer",
      fromId: getOrCreateIntegratedDeviceId(),
      toId: viewerId,
      sdp: offer,
    });
  }

  async function handleRemoteOfferMessage(message: Extract<LiveRemoteMessage, { type: "offer" }>) {
    if (deviceRole !== "monitor" || message.toId !== getOrCreateIntegratedDeviceId()) {
      return;
    }

    closeRemotePeerConnection();

    const peerConnection = new RTCPeerConnection(LIVE_REMOTE_ICE_CONFIGURATION);
    livePeerConnectionRef.current = peerConnection;
    remoteViewerIdRef.current = message.fromId;
    const remoteStream = ensureRemoteMediaStream();
    remoteStream.getTracks().forEach((track) => remoteStream.removeTrack(track));

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;

      if (stream) {
        remotePreviewStreamRef.current = stream;
        attachPreviewStream(stream);
        setCaptureStatus("preview");
        setRemoteBridgeStatus("Preview remoto conectado. Este dispositivo esta monitorando a fonte.");
        return;
      }

      const nextRemoteStream = ensureRemoteMediaStream();
      nextRemoteStream.addTrack(event.track);
      attachPreviewStream(nextRemoteStream);
      setCaptureStatus("preview");
      setRemoteBridgeStatus("Preview remoto conectado. Este dispositivo esta monitorando a fonte.");
    };

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      void sendLiveRemoteMessage({
        type: "ice-candidate",
        fromId: getOrCreateIntegratedDeviceId(),
        toId: message.fromId,
        candidate: event.candidate.toJSON(),
      });
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === "failed") {
        setRemoteBridgeStatus("Falha na conexao com a fonte. Tentando reabrir o preview remoto...");
        resetRemotePreviewState();
      }

      if (peerConnection.connectionState === "disconnected") {
        setRemoteBridgeStatus("Fonte desconectada. Aguardando nova conexao...");
      }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await sendLiveRemoteMessage({
      type: "answer",
      fromId: getOrCreateIntegratedDeviceId(),
      toId: message.fromId,
      sdp: answer,
    });
  }

  async function handleRemoteAnswerMessage(message: Extract<LiveRemoteMessage, { type: "answer" }>) {
    if (deviceRole !== "camera" || message.toId !== getOrCreateIntegratedDeviceId()) {
      return;
    }

    if (!livePeerConnectionRef.current) {
      return;
    }

    await livePeerConnectionRef.current.setRemoteDescription(
      new RTCSessionDescription(message.sdp),
    );
  }

  async function handleRemoteIceCandidateMessage(
    message: Extract<LiveRemoteMessage, { type: "ice-candidate" }>,
  ) {
    if (message.toId !== getOrCreateIntegratedDeviceId()) {
      return;
    }

    if (!livePeerConnectionRef.current) {
      return;
    }

    await livePeerConnectionRef.current.addIceCandidate(new RTCIceCandidate(message.candidate));
  }

  const refreshLinkedStageContext = useCallback(() => {
    if (!integratedMode || !linkedStageOption) {
      setLinkedStageContext(null);
      return null;
    }

    const nextContext = readLinkedStageContext(linkedStageOption);
    setLinkedStageContext(nextContext);
    return nextContext;
  }, [integratedMode, linkedStageOption]);

  const loadDevices = useCallback(async () => {
    try {
      setIsLoadingDevices(true);
      setError("");

      if (!navigator.mediaDevices?.enumerateDevices) {
        throw new Error("Seu navegador nao suporta listagem de dispositivos.");
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const nextVideoDevices = devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        }));
      const nextAudioDevices = devices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Microfone ${index + 1}`,
        }));

      setVideoDevices(nextVideoDevices);
      setAudioDevices(nextAudioDevices);

      const nextVideoSelection = nextVideoDevices.some(
        (device) => device.deviceId === selectedVideoDeviceId,
      )
        ? selectedVideoDeviceId
        : (nextVideoDevices[0]?.deviceId ?? "");
      const nextAudioSelection = nextAudioDevices.some(
        (device) => device.deviceId === selectedAudioDeviceId,
      )
        ? selectedAudioDeviceId
        : (nextAudioDevices[0]?.deviceId ?? "");

      if (nextVideoSelection !== selectedVideoDeviceId) {
        setSelectedVideoDeviceId(nextVideoSelection);
      }

      if (nextAudioSelection !== selectedAudioDeviceId) {
        setSelectedAudioDeviceId(nextAudioSelection);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nao foi possivel carregar os dispositivos.",
      );
    } finally {
      setIsLoadingDevices(false);
    }
  }, [selectedAudioDeviceId, selectedVideoDeviceId]);

  useEffect(() => {
    if (!boardFeaturesEnabled) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    getOrCreateIntegratedDeviceId();

    if (integratedMode) {
      const storedDeviceRole = window.localStorage.getItem(
        INTEGRATED_DEVICE_ROLE_STORAGE_KEY,
      ) as IntegratedDeviceRole | null;

      if (storedDeviceRole === "camera" || storedDeviceRole === "monitor") {
        setDeviceRole(storedDeviceRole);
        setActiveView(storedDeviceRole === "camera" ? "capture" : "admin");
      } else {
        setActiveView("admin");
      }
    }

    let hasStoredBoardRegion = false;

    const storedBoardRegionValue = window.localStorage.getItem(BOARD_REGION_STORAGE_KEY);

    if (storedBoardRegionValue) {
      try {
        const parsedBoardRegion = JSON.parse(storedBoardRegionValue) as BoardRegion;
        setBoardRegion(parsedBoardRegion);
        hasStoredBoardRegion = true;
        setHasSavedBoardRegion(true);
      } catch {
        window.localStorage.removeItem(BOARD_REGION_STORAGE_KEY);
      }
    }

    const storedValue = window.localStorage.getItem(STORAGE_KEY);

    if (!storedValue) {
      hasHydratedSettingsRef.current = true;
      return;
    }

    try {
      const parsed = JSON.parse(storedValue) as {
        boardRegion?: BoardRegion;
        selectedVideoDeviceId?: string;
        selectedAudioDeviceId?: string;
        isAudioEnabled?: boolean;
        isVideoEnabled?: boolean;
      };

      if (parsed.boardRegion && !hasStoredBoardRegion) {
        setBoardRegion(parsed.boardRegion);
      }

      if (parsed.selectedVideoDeviceId) {
        setSelectedVideoDeviceId(parsed.selectedVideoDeviceId);
      }

      if (parsed.selectedAudioDeviceId) {
        setSelectedAudioDeviceId(parsed.selectedAudioDeviceId);
      }

      if (typeof parsed.isAudioEnabled === "boolean") {
        setIsAudioEnabled(parsed.isAudioEnabled);
      }

      if (typeof parsed.isVideoEnabled === "boolean") {
        setIsVideoEnabled(parsed.isVideoEnabled);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      hasHydratedSettingsRef.current = true;
    }
  }, [boardFeaturesEnabled, integratedMode, loadDevices]);

  useEffect(() => {
    if (typeof window === "undefined" || !integratedMode) {
      return;
    }

    window.localStorage.setItem(INTEGRATED_DEVICE_ROLE_STORAGE_KEY, deviceRole);
  }, [deviceRole, integratedMode]);

  useEffect(() => {
    if (!integratedMode || deviceRole !== "monitor") {
      return;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setCaptureStatus("idle");
    setLiveSessionStatus("idle");
    liveSessionStatusRef.current = "idle";
    attachPreviewStream(remotePreviewStreamRef.current);
  }, [deviceRole, integratedMode]);

  useEffect(() => {
    if (!integratedMode) {
      return;
    }

    if (deviceRole === "camera") {
      setRemoteBridgeStatus("Este dispositivo ficou como fonte de captura da transmissao.");
      attachPreviewStream(streamRef.current);
      return;
    }

    setRemoteBridgeStatus("Este dispositivo ficou como monitor de controle da transmissao.");
  }, [deviceRole, integratedMode]);

  useEffect(() => {
    if (!integratedMode || !remoteChannelName) {
      setRemoteBridgeStatus("Selecione uma partida vinculada para conectar a transmissao.");
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setRemoteBridgeStatus("Supabase nao configurado. O preview remoto fica indisponivel.");
      return;
    }

    const deviceId = getOrCreateIntegratedDeviceId();
    const channel = supabase.channel(remoteChannelName);
    liveRemoteChannelRef.current = channel;

    channel.on(
      "broadcast",
      { event: LIVE_REMOTE_BROADCAST_EVENT },
      ({ payload }: { payload: LiveRemoteMessage }) => {
        if (!payload) {
          return;
        }

        if (payload.type === "viewer-ready") {
          if (deviceRole !== "camera" || payload.viewerId === deviceId || !streamRef.current) {
            return;
          }

          setRemoteBridgeStatus("Monitor conectado. Preparando preview remoto...");
          void createOfferForViewer(payload.viewerId);
          return;
        }

        if (payload.type === "state") {
          if (payload.deviceId === deviceId || payload.role !== "camera" || deviceRole !== "monitor") {
            return;
          }

          setCaptureStatus(payload.captureStatus);
          setLiveSessionStatus(payload.liveSessionStatus);
          liveSessionStatusRef.current = payload.liveSessionStatus;
          setRemoteBridgeStatus(
            payload.error
              ? `Fonte reportou erro: ${payload.error}`
              : buildRemoteStatusLabel(payload.captureStatus, payload.liveSessionStatus),
          );

          if (payload.captureStatus === "preview") {
            void announceViewerReady();
          } else {
            resetRemotePreviewState();
          }

          return;
        }

        if (payload.type === "command") {
          if (deviceRole !== "camera" || payload.fromId === deviceId) {
            return;
          }

          if (payload.command === "start-preview") {
            void startPreview();
            return;
          }

          if (payload.command === "stop-preview") {
            stopStream();
            return;
          }

          if (payload.command === "start-session") {
            void startLiveSession();
            return;
          }

          if (payload.command === "pause-session") {
            pauseLiveSession();
            return;
          }

          if (payload.command === "stop-session") {
            void stopLiveSession();
          }

          return;
        }

        if (payload.type === "offer") {
          void handleRemoteOfferMessage(payload);
          return;
        }

        if (payload.type === "answer") {
          void handleRemoteAnswerMessage(payload);
          return;
        }

        if (payload.type === "ice-candidate") {
          void handleRemoteIceCandidateMessage(payload);
        }
      },
    );

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (deviceRole === "camera") {
          setRemoteBridgeStatus("Este dispositivo esta pronto para transmitir o preview.");
          void broadcastIntegratedState();
          return;
        }

        setRemoteBridgeStatus("Monitor conectado. Aguardando a fonte de captura publicar o preview.");
        void announceViewerReady();
        return;
      }

      if (status === "CHANNEL_ERROR") {
        setRemoteBridgeStatus("Falha ao conectar o canal remoto da transmissao.");
      }
    });

    return () => {
      if (liveRemoteChannelRef.current === channel) {
        liveRemoteChannelRef.current = null;
      }

      closeRemotePeerConnection();
      if (deviceRole === "monitor") {
        resetRemotePreviewState();
      }
      void channel.unsubscribe();
    };
  }, [deviceRole, integratedMode, remoteChannelName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!integratedMode || deviceRole !== "camera" || !liveRemoteChannelRef.current) {
      return;
    }

    void broadcastIntegratedState();
  }, [captureStatus, deviceRole, error, integratedMode, liveSessionStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!boardFeaturesEnabled) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    if (!hasHydratedSettingsRef.current) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        boardRegion,
        selectedVideoDeviceId,
        selectedAudioDeviceId,
        isAudioEnabled,
        isVideoEnabled,
      }),
    );
  }, [
    boardFeaturesEnabled,
    boardRegion,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    isAudioEnabled,
    isVideoEnabled,
  ]);

  useEffect(() => {
    boardRegionRef.current = boardRegion;
  }, [boardRegion]);

  useEffect(() => {
    latestBoardDetectionRef.current = boardDetection;
  }, [boardDetection]);

  useEffect(() => {
    if (!integratedMode) {
      return;
    }

    refreshLinkedStageContext();

    function handleStorage(event: StorageEvent) {
      if (!linkedStageOption) {
        return;
      }

      if (event.key === null || event.key.includes(linkedStageOption.stageId)) {
        refreshLinkedStageContext();
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [integratedMode, linkedStageOption, refreshLinkedStageContext]);

  useEffect(() => {
    if (
      hasAttemptedAutoPreviewRef.current ||
      isLoadingDevices ||
      isRemoteMonitor ||
      captureStatus !== "idle" ||
      (!isVideoEnabled && !isAudioEnabled)
    ) {
      return;
    }

    if (isVideoEnabled && videoDevices.length === 0) {
      return;
    }

    if (isAudioEnabled && audioDevices.length === 0) {
      return;
    }

    hasAttemptedAutoPreviewRef.current = true;
    void startPreviewRef.current?.();
  }, [
    audioDevices.length,
    captureStatus,
    isAudioEnabled,
    isLoadingDevices,
    isRemoteMonitor,
    isVideoEnabled,
    videoDevices.length,
  ]);

  useEffect(() => {
    const stream = streamRef.current;

    if (!stream || captureStatus !== "preview") {
      return;
    }

    const syncVideo = async (element: HTMLVideoElement | null) => {
      if (!element) {
        return;
      }

      element.muted = true;
      element.playsInline = true;

      if (element.srcObject !== stream) {
        element.srcObject = stream;
      }

      const ensurePlay = async () => {
        try {
          await element.play();
        } catch {
          // Alguns navegadores ainda precisam de um tick depois do srcObject ou metadata.
        }
      };

      if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        await ensurePlay();
        return;
      }

      const onLoadedMetadata = () => {
        void ensurePlay();
      };

      element.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
      await ensurePlay();
    };

    void syncVideo(videoRef.current);
    void syncVideo(adminVideoRef.current);
  }, [activeView, captureStatus, isVideoEnabled, previewSessionId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const pendingMap = boardWorkerPendingRef.current;
    const worker = new Worker(
      new URL("../lib/live-lab/board-worker.worker.ts", import.meta.url),
    );

    boardWorkerRef.current = worker;

    worker.onmessage = (event: MessageEvent<BoardWorkerMessage>) => {
      const message = event.data;

      if (message.type === "error") {
        const pending = boardWorkerPendingRef.current.get(message.id);

        if (!pending) {
          return;
        }

        pendingMap.delete(message.id);
        pending.reject(new Error(message.message));
        return;
      }

      const pending = pendingMap.get(message.id);

      if (!pending) {
        return;
      }

      pendingMap.delete(message.id);
      pending.resolve(message.detection);
    };

    worker.onerror = () => {
      for (const [, pending] of pendingMap) {
        pending.reject(new Error("O worker do board falhou durante a analise."));
      }
      pendingMap.clear();
      setTranscriptError("O worker do board falhou durante a analise.");
    };

    return () => {
      for (const [, pending] of pendingMap) {
        pending.reject(new Error("O worker do board foi encerrado."));
      }
      pendingMap.clear();
      worker.terminate();
      boardWorkerRef.current = null;
    };
  }, [boardFeaturesEnabled]);

  useEffect(() => {
    if (!boardFeaturesEnabled) {
      boardPreviewLoopIdRef.current += 1;
      return;
    }

    if (activeView !== "admin" || captureStatus !== "preview" || !isVideoEnabled) {
      boardPreviewLoopIdRef.current += 1;
      return;
    }

    const loopId = boardPreviewLoopIdRef.current + 1;
    boardPreviewLoopIdRef.current = loopId;

    const drawPreviewLoop = () => {
      if (boardPreviewLoopIdRef.current !== loopId) {
        return;
      }

      const visibleCanvas = snapshotCanvasRef.current;

      if (visibleCanvas) {
        try {
          drawCurrentBoardFrame(visibleCanvas);
          if (latestBoardDetectionRef.current) {
            drawBoardDetections(visibleCanvas, latestBoardDetectionRef.current);
          }
        } catch {
          // O preview pode ainda nao estar pronto em alguns frames.
        }
      }

      window.setTimeout(drawPreviewLoop, 220);
    };

    drawPreviewLoop();

    return () => {
      boardPreviewLoopIdRef.current += 1;
    };
  }, [activeView, boardFeaturesEnabled, captureStatus, isVideoEnabled, boardRegion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Intencionalmente dirigido pelo estado do preview para manter o monitor do
  // board ativo sempre que a camera estiver rodando, independentemente da aba.
  useEffect(() => {
    if (!boardFeaturesEnabled) {
      if (boardMonitorStatus !== "idle") {
        stopBoardMonitor();
      }
      return;
    }

    if (captureStatus !== "preview" || !isVideoEnabled) {
      if (boardMonitorStatus !== "idle") {
        stopBoardMonitor();
      }
      return;
    }

    if (boardMonitorStatus === "idle") {
      void startBoardMonitor({ skipPreviewCheck: true, silent: true });
    }
  }, [boardFeaturesEnabled, boardMonitorStatus, captureStatus, isVideoEnabled, previewSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!boardFeaturesEnabled) {
      return;
    }

    if (captureStatus !== "preview" || !isVideoEnabled || previewSessionId === 0) {
      return;
    }

    const timerId = window.setTimeout(() => {
      stopBoardMonitor();
      void startBoardMonitor({ skipPreviewCheck: true, silent: true });
    }, 450);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [boardFeaturesEnabled, captureStatus, isVideoEnabled, previewSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadDevices();

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [loadDevices]);

  useEffect(() => {
    void (async () => {
      try {
        setIsLoadingSavedVideos(true);
        const clips = await listSavedHandClips();
        setSavedVideos(clips);
        handCounterRef.current = clips.length + 1;
      } catch (videosError) {
        setTranscriptError(
          videosError instanceof Error
            ? videosError.message
            : "Nao foi possivel carregar os videos salvos.",
        );
      } finally {
        setIsLoadingSavedVideos(false);
      }

      try {
        setIsLoadingSavedTranscripts(true);
        const transcripts = await listSavedTranscripts();
        setSavedTranscripts(transcripts);
        if (transcripts[0]?.id) {
          setSelectedTranscriptId((current) => current || transcripts[0].id);
        }
      } catch (transcriptsError) {
        setTranscriptError(
          transcriptsError instanceof Error
            ? transcriptsError.message
            : "Nao foi possivel carregar os txts salvos.",
        );
      } finally {
        setIsLoadingSavedTranscripts(false);
      }

      if (boardFeaturesEnabled) {
        try {
          setIsLoadingSavedCardSamples(true);
          const cardSamples = await listSavedCardSamples();
          setSavedCardSamples(cardSamples);
          if (cardSamples[0]?.id) {
            setSelectedCardSampleId((current) => current || cardSamples[0].id);
          }
        } catch (cardSamplesError) {
          setTranscriptError(
            cardSamplesError instanceof Error
              ? cardSamplesError.message
              : "Nao foi possivel carregar a base local das cartas.",
          );
        } finally {
          setIsLoadingSavedCardSamples(false);
        }
      } else {
        setSavedCardSamples([]);
        setSelectedCardSampleId("");
        setIsLoadingSavedCardSamples(false);
      }
    })();
  }, [boardFeaturesEnabled]);

  useEffect(() => {
    return () => {
      if (selectedVideoUrl) {
        URL.revokeObjectURL(selectedVideoUrl);
      }
    };
  }, [selectedVideoUrl]);

  useEffect(() => {
    return () => {
      if (selectedCardSampleUrl) {
        URL.revokeObjectURL(selectedCardSampleUrl);
      }
    };
  }, [selectedCardSampleUrl]);

  useEffect(() => {
    return () => {
      boardMonitorLoopIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!selectedCardSampleId) {
      if (selectedCardSampleUrl) {
        URL.revokeObjectURL(selectedCardSampleUrl);
      }
      setSelectedCardSampleUrl("");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const blob = await getSavedCardSampleBlob(selectedCardSampleId);

        if (cancelled) {
          return;
        }

        if (selectedCardSampleUrl) {
          URL.revokeObjectURL(selectedCardSampleUrl);
        }

        setSelectedCardSampleUrl(blob ? URL.createObjectURL(blob) : "");
      } catch (sampleError) {
        if (!cancelled) {
          setTranscriptError(
            sampleError instanceof Error
              ? sampleError.message
              : "Nao foi possivel abrir a amostra da carta.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCardSampleId, selectedCardSampleBlobVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const captureStatusLabel = useMemo(() => {
    if (captureStatus === "preview") {
      return "Preview ativo";
    }

    return "Parado";
  }, [captureStatus]);

  const liveSessionStatusLabel = useMemo(
    () =>
      liveSessionStatus === "running"
        ? "Sessao ativa"
        : liveSessionStatus === "paused"
          ? "Sessao pausada"
          : "Sessao parada",
    [liveSessionStatus],
  );

  const boardMonitorLabel = useMemo(() => {
    if (!boardFeaturesEnabled) {
      return "Standby";
    }

    if (boardMonitorStatus === "monitoring") {
      return "Monitorando";
    }

    if (boardMonitorStatus === "loading") {
      return "Carregando CV";
    }

    return "Parado";
  }, [boardFeaturesEnabled, boardMonitorStatus]);

  const linkedMatchLabel = useMemo(() => {
    if (!linkedStageContext) {
      return "Sem vinculo";
    }

    return `Partida ${linkedStageContext.currentMatchNumber}`;
  }, [linkedStageContext]);

  const linkedSeatSummaries = useMemo(() => {
    if (!linkedStageContext) {
      return [];
    }

    return linkedStageContext.seatAssignments.filter((seat) => Boolean(seat.playerName));
  }, [linkedStageContext]);
  const linkedBlindLabel = linkedStageContext?.currentBlindLabel ?? "Blind indisponivel";
  const linkedStageTitle = linkedStageContext?.stageTitle ?? "Nenhuma etapa vinculada";

  const boardCardSummaries = useMemo(() => {
    if (!boardDetection || boardDetection.boxes.length === 0) {
      return [];
    }

    return boardDetection.boxes.map((box, index) => {
      const readableLabel = formatBoardCardLabel(box);

      return {
        id: `board-card-${index + 1}`,
        index: index + 1,
        status: readableLabel ? "confirmada" : "candidata",
        label: readableLabel ?? `Carta ${index + 1} ainda sem leitura confirmada`,
        confidence:
          typeof box.combinedConfidence === "number"
            ? Math.round(box.combinedConfidence * 100)
            : typeof box.confidence === "number"
              ? Math.round(box.confidence * 100)
              : null,
      };
    });
  }, [boardDetection]);

  const selectedCardSample = useMemo(
    () => savedCardSamples.find((sample) => sample.id === selectedCardSampleId) ?? null,
    [savedCardSamples, selectedCardSampleId],
  );

  async function refreshSavedVideos() {
    try {
      setIsLoadingSavedVideos(true);
      const clips = await listSavedHandClips();
      setSavedVideos(clips);
      handCounterRef.current = clips.length + 1;
    } catch (videosError) {
      setTranscriptError(
        videosError instanceof Error
          ? videosError.message
          : "Nao foi possivel carregar os videos salvos.",
      );
    } finally {
      setIsLoadingSavedVideos(false);
    }
  }

  async function refreshSavedTranscripts() {
    try {
      setIsLoadingSavedTranscripts(true);
      const transcripts = await listSavedTranscripts();
      setSavedTranscripts(transcripts);
      if (!selectedTranscriptId && transcripts[0]?.id) {
        setSelectedTranscriptId(transcripts[0].id);
      }
    } catch (transcriptsError) {
      setTranscriptError(
        transcriptsError instanceof Error
          ? transcriptsError.message
          : "Nao foi possivel carregar os txts salvos.",
      );
    } finally {
      setIsLoadingSavedTranscripts(false);
    }
  }

  async function refreshSavedCardSamples() {
    try {
      setIsLoadingSavedCardSamples(true);
      const cardSamples = await listSavedCardSamples();
      setSavedCardSamples(cardSamples);
      if (!selectedCardSampleId && cardSamples[0]?.id) {
        setSelectedCardSampleId(cardSamples[0].id);
      } else if (
        selectedCardSampleId &&
        !cardSamples.some((sample) => sample.id === selectedCardSampleId)
      ) {
        setSelectedCardSampleId(cardSamples[0]?.id ?? "");
      }
    } catch (cardSamplesError) {
      setTranscriptError(
        cardSamplesError instanceof Error
          ? cardSamplesError.message
          : "Nao foi possivel atualizar a base local das cartas.",
      );
    } finally {
      setIsLoadingSavedCardSamples(false);
    }
  }

  async function startPreview() {
    try {
      setError("");

      if (isRemoteMonitor) {
        setRemoteBridgeStatus("Enviando comando para a fonte abrir o preview...");
        await sendLiveRemoteMessage({
          type: "command",
          fromId: getOrCreateIntegratedDeviceId(),
          command: "start-preview",
        });
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Seu navegador nao suporta captura de camera e microfone.");
      }

      stopStream();

      let nextStream: MediaStream;

      try {
        nextStream = await navigator.mediaDevices.getUserMedia({
          video: isVideoEnabled
            ? {
                deviceId: selectedVideoDeviceId ? { exact: selectedVideoDeviceId } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 30 },
              }
            : false,
          audio: isAudioEnabled
            ? {
                deviceId: selectedAudioDeviceId ? { exact: selectedAudioDeviceId } : undefined,
                echoCancellation: true,
                noiseSuppression: true,
              }
            : false,
        });
      } catch {
        nextStream = await navigator.mediaDevices.getUserMedia({
          video: isVideoEnabled
            ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 30 },
              }
            : false,
          audio: isAudioEnabled
            ? {
                echoCancellation: true,
                noiseSuppression: true,
              }
            : false,
        });
      }

      streamRef.current = nextStream;
      nextStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoEnabled;
      });
      nextStream.getAudioTracks().forEach((track) => {
        track.enabled = isAudioEnabled;
      });

      for (const element of [videoRef.current, adminVideoRef.current]) {
        if (!element) {
          continue;
        }

        element.srcObject = nextStream;
        try {
          await element.play();
        } catch {
          // O stream pode estar valido mesmo que o elemento ainda nao consiga tocar neste frame.
        }
      }

      await loadDevices();
      setCaptureStatus("preview");
      setPreviewSessionId((current) => current + 1);
      await broadcastIntegratedState({
        captureStatus: "preview",
        error: "",
      });
    } catch (previewError) {
      setCaptureStatus("idle");
      const nextError =
        previewError instanceof Error
          ? previewError.message
          : "Nao foi possivel iniciar o preview.";
      setError(nextError);
      await broadcastIntegratedState({
        captureStatus: "idle",
        error: nextError,
      });
    }
  }

  useEffect(() => {
    startPreviewRef.current = startPreview;
  });

  async function ensurePreviewReady() {
    if (streamRef.current) {
      return true;
    }

    await startPreview();
    return Boolean(streamRef.current);
  }

  function stopStream() {
    if (isRemoteMonitor) {
      setRemoteBridgeStatus("Enviando comando para a fonte encerrar o preview...");
      void sendLiveRemoteMessage({
        type: "command",
        fromId: getOrCreateIntegratedDeviceId(),
        command: "stop-preview",
      });
      resetRemotePreviewState();
      return;
    }

    void stopLiveSession({ restartBoardMonitor: false });
    clearRemotePreviewStream();

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (adminVideoRef.current) {
      adminVideoRef.current.srcObject = null;
    }

    setCaptureStatus("idle");
    void broadcastIntegratedState({
      captureStatus: "idle",
      liveSessionStatus: liveSessionStatusRef.current,
      error: "",
    });
  }

  function getSpeechRecognitionConstructor() {
    const speechWindow = window as BrowserWindowWithSpeech;
    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
  }

  function startCommandRecognition() {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();

    if (!SpeechRecognitionCtor) {
      setCommandEngineLabel("Comando por navegador indisponivel; usando fallback local");
      return false;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "pt-BR";

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index]?.[0]?.transcript?.trim() ?? "";
        if (!transcript) {
          continue;
        }

        handleTranscriptCommand(transcript, "browser");
      }
    };

    recognition.onerror = (event) => {
      setCommandEngineLabel(`Reconhecimento do navegador com erro: ${event.error}`);
    };

    recognition.onend = () => {
      if (shouldKeepCommandRecognitionRef.current) {
        try {
          recognition.start();
          setCommandEngineLabel("Escutando comandos de voz pelo navegador");
        } catch {
          setCommandEngineLabel("Tentando reativar o reconhecimento de voz");
        }
      }
    };

    commandRecognitionRef.current = recognition;
    shouldKeepCommandRecognitionRef.current = true;
    recognition.start();
    setCommandEngineLabel("Escutando comandos de voz pelo navegador");
    return true;
  }

  function stopCommandRecognition() {
    shouldKeepCommandRecognitionRef.current = false;
    commandRecognitionRef.current?.stop();
    commandRecognitionRef.current = null;
  }

  async function startLiveSession() {
    try {
      setTranscriptError("");

      if (isRemoteMonitor) {
        setRemoteBridgeStatus("Enviando comando para a fonte iniciar a sessao continua...");
        await sendLiveRemoteMessage({
          type: "command",
          fromId: getOrCreateIntegratedDeviceId(),
          command: "start-session",
        });
        return;
      }

      const currentLinkedStageContext = refreshLinkedStageContext();

      if (integratedMode && !currentLinkedStageContext) {
        throw new Error(
          "Vincule a transmissao a uma partida ativa da mesa antes de iniciar a sessao.",
        );
      }

      if (liveSessionStatusRef.current === "paused") {
        const ready = await ensurePreviewReady();

        if (!ready || !streamRef.current) {
          throw new Error("Nao foi possivel retomar a sessao continua.");
        }

        if (sessionRecorderRef.current?.state === "paused") {
          sessionRecorderRef.current.resume();
        }

        if (activeHandRef.current?.recorder.state === "paused") {
          activeHandRef.current.recorder.resume();
        }

        liveSessionStatusRef.current = "running";
        setLiveSessionStatus("running");
        await broadcastIntegratedState({
          liveSessionStatus: "running",
          error: "",
        });
        startCommandRecognition();
        commandLoopIdRef.current += 1;
        void runCommandLoop(commandLoopIdRef.current);
        return;
      }

      const ready = await ensurePreviewReady();

      if (!ready || !streamRef.current) {
        throw new Error("Nao foi possivel preparar o preview para iniciar a sessao.");
      }

      if (!streamRef.current.getAudioTracks()[0]) {
        throw new Error("A sessao continua precisa de audio ativo para detectar os comandos.");
      }

      if (sessionRecorderRef.current && sessionRecorderRef.current.state !== "inactive") {
        return;
      }

      const mimeType = getPreferredMimeType();
      const sessionRecorder = mimeType
        ? new MediaRecorder(streamRef.current, { mimeType })
        : new MediaRecorder(streamRef.current);

      sessionRecorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) {
          return;
        }
      };

      sessionRecorderRef.current = sessionRecorder;
      sessionRecorder.start(1000);

      liveSessionStatusRef.current = "running";
      commandLoopIdRef.current += 1;
      setLiveSessionStatus("running");
      await broadcastIntegratedState({
        liveSessionStatus: "running",
        error: "",
      });
      setTranscriptFeed([]);
      sessionTranscriptStartedAtRef.current = new Date().toISOString();
      sessionTranscriptLinesRef.current = [];

      if (currentLinkedStageContext) {
        appendSessionTranscriptLine(
          `Sistema: transmissao vinculada a ${currentLinkedStageContext.stageTitle}`,
        );
        if (currentLinkedStageContext.currentBlindLabel) {
          appendSessionTranscriptLine(
            `Sistema: blind ${currentLinkedStageContext.currentBlindLabel}`,
          );
        }
        currentLinkedStageContext.seatAssignments.forEach((seat) => {
          if (!seat.playerName) {
            return;
          }

          appendSessionTranscriptLine(`Sistema: Lugar ${seat.seatIndex + 1} ${seat.playerName}`);
        });
      }

      startCommandRecognition();

      void runCommandLoop(commandLoopIdRef.current);
    } catch (sessionError) {
      setTranscriptError(
        sessionError instanceof Error
          ? sessionError.message
          : "Nao foi possivel iniciar a sessao continua.",
      );
    }
  }

  function pauseLiveSession() {
    if (isRemoteMonitor) {
      setRemoteBridgeStatus("Enviando comando para pausar a sessao continua...");
      void sendLiveRemoteMessage({
        type: "command",
        fromId: getOrCreateIntegratedDeviceId(),
        command: "pause-session",
      });
      return;
    }

    if (liveSessionStatusRef.current !== "running") {
      return;
    }

    liveSessionStatusRef.current = "paused";
    setLiveSessionStatus("paused");
    commandLoopIdRef.current += 1;
    stopCommandRecognition();
    setCommandEngineLabel("Sessao pausada");

    if (sessionRecorderRef.current?.state === "recording") {
      sessionRecorderRef.current.pause();
    }

    if (activeHandRef.current?.recorder.state === "recording") {
      activeHandRef.current.recorder.pause();
    }
    void broadcastIntegratedState({
      liveSessionStatus: "paused",
      error: "",
    });
  }

  function appendSessionTranscriptLine(content: string) {
    sessionTranscriptLinesRef.current = [
      ...sessionTranscriptLinesRef.current,
      `[${formatTimeOnly(new Date().toISOString())}] ${content}`,
    ];
  }

  async function stopLiveSession(options: { restartBoardMonitor?: boolean } = {}) {
    const { restartBoardMonitor = true } = options;

    if (isRemoteMonitor) {
      setRemoteBridgeStatus("Enviando comando para encerrar a sessao continua...");
      await sendLiveRemoteMessage({
        type: "command",
        fromId: getOrCreateIntegratedDeviceId(),
        command: "stop-session",
      });
      return;
    }

    liveSessionStatusRef.current = "idle";
    setLiveSessionStatus("idle");
    commandLoopIdRef.current += 1;
    stopCommandRecognition();
    setCommandEngineLabel("Sessao parada");
    stopBoardMonitor();

    if (sessionRecorderRef.current && sessionRecorderRef.current.state !== "inactive") {
      sessionRecorderRef.current.stop();
    }
    sessionRecorderRef.current = null;

    if (activeHandRef.current) {
      await finalizeCurrentHand("sessao encerrada");
    }

    await persistCurrentSessionTranscript();

    if (
      boardFeaturesEnabled &&
      restartBoardMonitor &&
      streamRef.current &&
      captureStatus === "preview" &&
      isVideoEnabled
    ) {
      await startBoardMonitor({ skipPreviewCheck: true, silent: true });
    }

    await broadcastIntegratedState({
      liveSessionStatus: "idle",
      error: "",
    });
  }

  async function runCommandLoop(loopId: number) {
    while (liveSessionStatusRef.current === "running" && commandLoopIdRef.current === loopId) {
      const audioTrack = streamRef.current?.getAudioTracks()[0];

      if (!audioTrack) {
        setTranscriptError("A sessao perdeu o audio da transmissao.");
        stopLiveSession();
        return;
      }

      try {
        const wavBlob = await captureWaveSample(
          new MediaStream([audioTrack]),
          COMMAND_SAMPLE_DURATION_MS,
        );
        const formData = new FormData();
        formData.append("audio", new File([wavBlob], "session-sample.wav", { type: "audio/wav" }));

        const response = await fetch("/api/live-lab/transcribe", {
          method: "POST",
          body: formData,
        });
        const data = (await response.json()) as
          | { success: true; text: string }
          | { error?: string };

        if (!response.ok) {
          throw new Error("error" in data && data.error ? data.error : "Falha ao transcrever.");
        }

        handleTranscriptCommand(("text" in data ? data.text : "") ?? "", "whisper");
      } catch (loopError) {
        setTranscriptError(
          loopError instanceof Error
            ? loopError.message
            : "Erro ao processar a transcricao continua.",
        );
      }

      await wait(250);
    }
  }

  function handleTranscriptCommand(rawText: string, source: "browser" | "whisper") {
    const normalized = normalizeCommandText(rawText);
    const command = detectTranscriptCommand(normalized);
    const cleanText = rawText.trim();
    const shouldPersistLine = shouldPersistTranscriptLine({
      source,
      normalized,
      cleanText,
    });

    if (cleanText && shouldPersistLine) {
      appendSessionTranscriptLine(`${source === "browser" ? "Navegador" : "Whisper"}: ${cleanText}`);
    }

    if (shouldPersistLine || command !== "none") {
      setTranscriptFeed((current) => [
        {
          id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          at: new Date().toISOString(),
          text: `${source === "browser" ? "[Navegador] " : "[Whisper] "}${cleanText || "(sem fala detectada)"}`,
          command,
        },
        ...current,
      ].slice(0, 24));
    }

    if (activeHandRef.current && cleanText && shouldPersistLine) {
      activeHandRef.current.transcriptLog.push(cleanText);
    }

    if (command === "start" && !activeHandRef.current) {
      appendSessionTranscriptLine("Sistema: comando de voz detectado para iniciar partida");
      startNewHand(cleanText || "nova partida");
      return;
    }

    if (command === "end" && activeHandRef.current) {
      appendSessionTranscriptLine("Sistema: comando de voz detectado para encerrar partida");
      void finalizeCurrentHand(cleanText || "encerrar partida");
      return;
    }

    if (command === "save" && activeHandRef.current) {
      activeHandRef.current.markedForSave = true;
      appendSessionTranscriptLine("Sistema: mao marcada para salvar");
    }
  }

  function startNewHand(triggerText: string) {
    if (!streamRef.current) {
      setTranscriptError("O preview precisa estar ativo para iniciar uma nova partida.");
      return;
    }

    const mimeType = getPreferredMimeType() || "video/webm";
    const recorder = mimeType
      ? new MediaRecorder(streamRef.current, { mimeType })
      : new MediaRecorder(streamRef.current);
    const title = integratedMode
      ? `${linkedMatchLabel} · Mao ${handCounterRef.current}`
      : `Mao ${handCounterRef.current}`;
    const handSession: ActiveHandSession = {
      id: `hand-${Date.now()}`,
      title,
      startedAt: Date.now(),
      startTrigger: triggerText,
      transcriptLog: [triggerText],
      markedForSave: !integratedMode,
      mimeType,
      recorder,
      chunks: [],
    };

    recorder.ondataavailable = (event) => {
      if (!event.data || event.data.size === 0) {
        return;
      }

      handSession.chunks.push(event.data);
    };

    recorder.start(1000);
    activeHandRef.current = handSession;
    setActiveHandTitle(title);
    setActiveHandStartedAtIso(new Date().toISOString());
  }

  async function finalizeCurrentHand(triggerText: string) {
    const currentHand = activeHandRef.current;

    if (!currentHand || isFinalizingHandRef.current) {
      return;
    }

    isFinalizingHandRef.current = true;

    try {
      activeHandRef.current = null;
      setActiveHandTitle("");
      setActiveHandStartedAtIso("");

      const endedAt = Date.now();
      await new Promise<void>((resolve, reject) => {
        if (currentHand.recorder.state === "inactive") {
          resolve();
          return;
        }

        currentHand.recorder.onstop = () => resolve();
        currentHand.recorder.onerror = () =>
          reject(new Error("Falha ao encerrar a gravacao da partida."));
        currentHand.recorder.stop();
      });

      const blob = new Blob(currentHand.chunks, { type: currentHand.mimeType });

      if (currentHand.markedForSave) {
        await saveHandClip({
          title: currentHand.title,
          startedAt: new Date(currentHand.startedAt).toISOString(),
          endedAt: new Date(endedAt).toISOString(),
          durationSeconds: Math.max(1, Math.round((endedAt - currentHand.startedAt) / 1000)),
          sizeBytes: blob.size,
          mimeType: currentHand.mimeType,
          startTrigger: currentHand.startTrigger,
          endTrigger: triggerText,
          transcriptLog: [...currentHand.transcriptLog, triggerText],
          linkedStageId: linkedStageContext?.stageId ?? null,
          linkedStageTitle: linkedStageContext?.stageTitle ?? null,
          linkedMatchLabel,
          linkedBlindLabel: linkedStageContext?.currentBlindLabel ?? null,
          blob,
        });

        await refreshSavedVideos();
      }

      handCounterRef.current += 1;
    } finally {
      isFinalizingHandRef.current = false;
    }
  }

  function getBoardSourceVideoElement() {
    const candidates = [adminVideoRef.current, videoRef.current];

    return (
      candidates.find((element) => element && element.videoWidth > 0 && element.videoHeight > 0) ??
      null
    );
  }

  function drawCurrentBoardFrame(canvas: HTMLCanvasElement) {
    const video = getBoardSourceVideoElement();
    const currentBoardRegion = boardRegionRef.current;

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error("Inicie o preview antes de analisar a regiao do board.");
    }

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Nao foi possivel preparar o canvas da analise do board.");
    }

    const sx = (currentBoardRegion.x / 100) * video.videoWidth;
    const sy = (currentBoardRegion.y / 100) * video.videoHeight;
    const sWidth = (currentBoardRegion.width / 100) * video.videoWidth;
    const sHeight = (currentBoardRegion.height / 100) * video.videoHeight;

    const scale = Math.min(
      1,
      BOARD_ANALYSIS_MAX_WIDTH / Math.max(sWidth, 1),
      BOARD_ANALYSIS_MAX_HEIGHT / Math.max(sHeight, 1),
    );

    canvas.width = Math.max(1, Math.round(sWidth * scale));
    canvas.height = Math.max(1, Math.round(sHeight * scale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
  }

  function getBoardProcessingCanvas() {
    if (!boardProcessingCanvasRef.current && typeof document !== "undefined") {
      boardProcessingCanvasRef.current = document.createElement("canvas");
    }

    return boardProcessingCanvasRef.current;
  }

  function cropBoardCardToDataUrl(
    sourceCanvas: HTMLCanvasElement,
    box: BoardDetectionResult["boxes"][number],
  ) {
    if (typeof document === "undefined") {
      return "";
    }

    const paddingX = Math.max(4, Math.round(box.width * 0.08));
    const paddingY = Math.max(4, Math.round(box.height * 0.08));
    const sx = Math.max(0, Math.floor(box.x - paddingX));
    const sy = Math.max(0, Math.floor(box.y - paddingY));
    const sw = Math.min(sourceCanvas.width - sx, Math.ceil(box.width + paddingX * 2));
    const sh = Math.min(sourceCanvas.height - sy, Math.ceil(box.height + paddingY * 2));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, sw);
    canvas.height = Math.max(1, sh);
    const context = canvas.getContext("2d");

    if (!context) {
      return "";
    }

    context.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  }

  function buildBoardPredictionSignature(detection: BoardDetectionResult) {
    return [
      detection.stage,
      detection.cardCount,
      ...detection.boxes.map((box) =>
        [
          Math.round(box.x / 6),
          Math.round(box.y / 6),
          Math.round(box.width / 6),
          Math.round(box.height / 6),
        ].join(":"),
      ),
    ].join("|");
  }

  function hashBoardCardImage(dataUrl: string) {
    let hash = 0;

    for (let index = 0; index < dataUrl.length; index += 17) {
      hash = (hash * 31 + dataUrl.charCodeAt(index)) >>> 0;
    }

    return hash.toString(16);
  }

  async function classifyBoardCardImages(images: string[]) {
    const response = await fetch("/api/live-lab/card-classify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ images }),
    });

    const payload = (await response.json()) as {
      error?: string;
      predictions?: BoardCardClassifierPrediction[];
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Nao foi possivel classificar as cartas do board.");
    }

    return payload.predictions ?? [];
  }

  async function enrichBoardDetectionWithPredictions(
    sourceCanvas: HTMLCanvasElement,
    detection: BoardDetectionResult,
  ) {
    if (detection.cardCount === 0 || detection.boxes.length === 0) {
      boardPredictionSignatureRef.current = "";
      return;
    }

    const signature = buildBoardPredictionSignature(detection);

    if (signature === boardPredictionSignatureRef.current) {
      return;
    }

    boardPredictionSignatureRef.current = signature;
    const requestId = boardPredictionRequestIdRef.current + 1;
    boardPredictionRequestIdRef.current = requestId;

    const inputs = detection.boxes.map((box) => {
      const image = cropBoardCardToDataUrl(sourceCanvas, box);
      const cacheKey = `${detection.stage}:${detection.cardCount}:${hashBoardCardImage(image)}`;

      return {
        cacheKey,
        image,
      };
    });

    const uncachedInputs = inputs.filter(
      (input) => input.image && !cardPredictionCacheRef.current.has(input.cacheKey),
    );

    try {
      if (uncachedInputs.length > 0) {
        const predictions = await classifyBoardCardImages(uncachedInputs.map((input) => input.image));

        uncachedInputs.forEach((input, index) => {
          const prediction = predictions[index];

          if (prediction) {
            cardPredictionCacheRef.current.set(input.cacheKey, prediction);
          }
        });
      }

      if (requestId !== boardPredictionRequestIdRef.current) {
        return;
      }

      const classifiedBoxes = detection.boxes.map((box, index) => {
        const prediction = cardPredictionCacheRef.current.get(inputs[index].cacheKey);

        if (!prediction) {
          return box;
        }

        return {
          ...box,
          rankGuess: prediction.rankGuess,
          suitGuess: prediction.suitGuess,
          rankConfidence: prediction.rankConfidence,
          suitConfidence: prediction.suitConfidence,
          combinedConfidence: prediction.combinedConfidence,
          label: prediction.label,
        };
      });

      const nextDetection = {
        ...detection,
        boxes: classifiedBoxes,
      };

      latestBoardDetectionRef.current = nextDetection;
      setBoardDetection(nextDetection);
    } catch (classificationError) {
      setTranscriptError(
        classificationError instanceof Error
          ? classificationError.message
          : "Nao foi possivel identificar as cartas do board.",
      );
    }
  }

  async function analyzeBoardInWorker(canvas: HTMLCanvasElement) {
    const worker = boardWorkerRef.current;
    const context = canvas.getContext("2d");

    if (!worker || !context) {
      throw new Error("O worker do board ainda nao esta disponivel.");
    }

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const requestId = boardWorkerRequestIdRef.current + 1;
    boardWorkerRequestIdRef.current = requestId;

    return await new Promise<BoardDetectionResult>((resolve, reject) => {
      boardWorkerPendingRef.current.set(requestId, { resolve, reject });

      worker.postMessage(
        {
          id: requestId,
          type: "analyze",
          width: imageData.width,
          height: imageData.height,
          data: imageData.data.buffer,
        },
        [imageData.data.buffer],
      );
    });
  }

  async function runBoardDetection(origin: "snapshot" | "monitor") {
    const processingCanvas = getBoardProcessingCanvas();

    if (!processingCanvas) {
      throw new Error("Canvas interno da analise do board nao esta disponivel.");
    }

    drawCurrentBoardFrame(processingCanvas);
    const rawDetection = await analyzeBoardInWorker(processingCanvas);
    const detection = stabilizeBoardDetection(rawDetection);
    setBoardDetection(detection);
    setBoardRuntimeLabel("Worker do board ativo");
    void enrichBoardDetectionWithPredictions(processingCanvas, detection);

    const visibleCanvas = snapshotCanvasRef.current;

    if (visibleCanvas) {
      const visibleContext = visibleCanvas.getContext("2d");

      if (visibleContext) {
        visibleCanvas.width = processingCanvas.width;
        visibleCanvas.height = processingCanvas.height;
        visibleContext.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height);
        visibleContext.drawImage(processingCanvas, 0, 0);
        drawBoardDetections(visibleCanvas, detection);
      }
    }

    const signature = `${detection.stage}:${detection.cardCount}`;
    const previousCardCount = lastBoardCardCountRef.current;
    const stageChanged = signature !== lastBoardSignatureRef.current;

    if (origin === "monitor" && stageChanged) {
      lastBoardSignatureRef.current = signature;
      lastBoardCardCountRef.current = detection.cardCount;

      if (detection.stage === "flop" || detection.stage === "turn" || detection.stage === "river") {
        const boardLine = `[${formatTimeOnly(detection.detectedAt)}] Board: ${formatBoardStage(detection.stage)} detectado automaticamente`;
        sessionTranscriptLinesRef.current = [...sessionTranscriptLinesRef.current, boardLine];

        if (activeHandRef.current) {
          activeHandRef.current.transcriptLog.push(`${formatBoardStage(detection.stage)} detectado automaticamente`);
        }
      }

      if (previousCardCount > 0 && detection.cardCount === 0 && activeHandRef.current) {
        const clearLine = `[${formatTimeOnly(detection.detectedAt)}] Board: cartas removidas da mesa, encerrando partida automaticamente`;
        sessionTranscriptLinesRef.current = [...sessionTranscriptLinesRef.current, clearLine];
        activeHandRef.current.transcriptLog.push("Board limpo, partida encerrada automaticamente");
        void finalizeCurrentHand("board limpo automaticamente");
      }
    }

  }

  async function saveCurrentBoardCardsToDataset() {
    if (!boardDetection || boardDetection.boxes.length === 0) {
      setTranscriptError("Nenhuma carta foi detectada no board para salvar no dataset.");
      return;
    }

    const processingCanvas = getBoardProcessingCanvas();

    if (!processingCanvas) {
      setTranscriptError("Canvas interno do board indisponivel para recortar as cartas.");
      return;
    }

    try {
      setTranscriptError("");
      drawCurrentBoardFrame(processingCanvas);
      const savedSummaries: SavedCardSampleSummary[] = [];

      for (const [index, box] of boardDetection.boxes.entries()) {
        const blob = await cropCardBoxToBlob(processingCanvas, box);

        if (!blob) {
          continue;
        }

        const summary = await saveCardSample({
          blob,
          capturedAt: boardDetection.detectedAt,
          boardStage: boardDetection.stage,
          sourceImageName: null,
          sourceCardIndex: index + 1,
          sourceCardCount: boardDetection.cardCount,
          width: Math.max(1, Math.round(box.width)),
          height: Math.max(1, Math.round(box.height)),
          confidence: typeof box.confidence === "number" ? box.confidence : null,
          cornerConfidence:
            typeof box.cornerConfidence === "number" ? box.cornerConfidence : null,
          rankLabel: box.rankGuess ?? null,
          suitLabel: box.suitGuess ?? null,
        });
        savedSummaries.push(summary);
      }

      await refreshSavedCardSamples();

      if (savedSummaries[0]?.id) {
        setSelectedCardSampleId(savedSummaries[0].id);
      }
    } catch (cardSampleError) {
      setTranscriptError(
        cardSampleError instanceof Error
          ? cardSampleError.message
          : "Nao foi possivel salvar os recortes das cartas.",
      );
    }
  }

  async function cropCardBoxToBlob(
    canvas: HTMLCanvasElement,
    box: BoardDetectionResult["boxes"][number],
  ) {
    const cropCanvas = document.createElement("canvas");
    const paddingX = Math.max(2, Math.round(box.width * 0.08));
    const paddingY = Math.max(2, Math.round(box.height * 0.08));
    const sx = Math.max(0, Math.round(box.x - paddingX));
    const sy = Math.max(0, Math.round(box.y - paddingY));
    const sw = Math.min(canvas.width - sx, Math.round(box.width + paddingX * 2));
    const sh = Math.min(canvas.height - sy, Math.round(box.height + paddingY * 2));

    cropCanvas.width = Math.max(1, sw);
    cropCanvas.height = Math.max(1, sh);

    const cropContext = cropCanvas.getContext("2d");

    if (!cropContext) {
      throw new Error("Nao foi possivel preparar o recorte da carta.");
    }

    cropContext.drawImage(canvas, sx, sy, sw, sh, 0, 0, cropCanvas.width, cropCanvas.height);

    return await new Promise<Blob | null>((resolve) => {
      cropCanvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  async function saveSelectedCardSampleLabels(
    id: string,
    labels: { rankLabel: string | null; suitLabel: string | null },
  ) {
    try {
      setTranscriptError("");
      await updateSavedCardSampleLabels(id, labels);
      await refreshSavedCardSamples();
    } catch (sampleError) {
      setTranscriptError(
        sampleError instanceof Error
          ? sampleError.message
          : "Nao foi possivel atualizar os rótulos da carta.",
      );
    }
  }

  async function exportLabeledCardDataset() {
    const labeledSamples = savedCardSamples.filter(
      (sample): sample is SavedCardSampleSummary & { rankLabel: string; suitLabel: string } =>
        Boolean(sample.rankLabel && sample.suitLabel),
    );

    if (labeledSamples.length === 0) {
      setCardDatasetStatus("Ainda nao existem cartas rotuladas para exportar.");
      return;
    }

    try {
      setTranscriptError("");
      setIsExportingCardDataset(true);
      setCardDatasetStatus("Exportando dataset rotulado das cartas...");
      const exportedSamples: ExportedCardDatasetSample[] = [];

      for (const sample of labeledSamples) {
        const blob = await getSavedCardSampleBlob(sample.id);

        if (!blob) {
          continue;
        }

        const extension = resolveImageExtension(blob.type);
        exportedSamples.push({
          id: sample.id,
          fileName: buildCardDatasetFileName(sample, extension),
          capturedAt: sample.capturedAt,
          boardStage: sample.boardStage,
          sourceImageName: sample.sourceImageName,
          sourceCardIndex: sample.sourceCardIndex,
          sourceCardCount: sample.sourceCardCount,
          width: sample.width,
          height: sample.height,
          confidence: sample.confidence,
          cornerConfidence: sample.cornerConfidence,
          rankLabel: sample.rankLabel,
          suitLabel: sample.suitLabel,
          imageDataUrl: await blobToDataUrl(blob),
        });
      }

      const payload: ExportedCardDatasetPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        source: "shpl-live-lab",
        sampleCount: exportedSamples.length,
        samples: exportedSamples,
      };

      const exportBlob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const downloadUrl = URL.createObjectURL(exportBlob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `shpl-live-lab-card-dataset-${formatFileTimestamp(new Date())}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);

      setCardDatasetStatus(
        `${exportedSamples.length} amostra(s) rotulada(s) exportada(s) para treino.`,
      );
    } catch (exportError) {
      setTranscriptError(
        exportError instanceof Error
          ? exportError.message
          : "Nao foi possivel exportar o dataset das cartas.",
      );
      setCardDatasetStatus("Nao foi possivel exportar o dataset das cartas.");
    } finally {
      setIsExportingCardDataset(false);
    }
  }

  async function removeSelectedCardSample() {
    if (!selectedCardSampleId) {
      return;
    }

    try {
      setTranscriptError("");
      await deleteSavedCardSample(selectedCardSampleId);
      setSelectedCardSampleId("");
      await refreshSavedCardSamples();
    } catch (sampleError) {
      setTranscriptError(
        sampleError instanceof Error
          ? sampleError.message
          : "Nao foi possivel excluir a amostra da carta.",
      );
    }
  }

  async function handleImportCardPhotoFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    try {
      setTranscriptError("");
      setCardDatasetStatus("Importando fotos para o dataset...");
      setIsImportingCardPhotos(true);
      const importedSummaries: SavedCardSampleSummary[] = [];
      const failedFiles: string[] = [];

      for (const file of Array.from(fileList)) {
        try {
          const image = await loadImageFromFile(file);
          const detectedBoxes = await detectCardBoxesFromPhotoWithFallback(image);

          for (const [index, box] of detectedBoxes.entries()) {
            const blob = await cropPhotoCardToBlob(image, box);

            if (!blob) {
              continue;
            }

            const summary = await saveCardSample({
              blob,
              capturedAt: new Date().toISOString(),
              boardStage: "unknown",
              sourceImageName: file.name,
              sourceCardIndex: index + 1,
              sourceCardCount: detectedBoxes.length,
              width: box.width,
              height: box.height,
              confidence: null,
              cornerConfidence: null,
              rankLabel: null,
              suitLabel: null,
            });

            importedSummaries.push(summary);
          }
        } catch {
          failedFiles.push(file.name);
        }
      }

      await refreshSavedCardSamples();

      if (importedSummaries[0]?.id) {
        setSelectedCardSampleId(importedSummaries[0].id);
      }

      if (importedSummaries.length === 0) {
        setCardDatasetStatus(
          failedFiles.length > 0
            ? `Nenhuma foto entrou no dataset. Falharam: ${failedFiles.join(", ")}`
            : "Nenhuma foto foi importada para o dataset.",
        );
      } else if (failedFiles.length > 0) {
        setCardDatasetStatus(
          `${importedSummaries.length} amostra(s) importada(s). Falharam: ${failedFiles.join(", ")}`,
        );
      } else {
        setCardDatasetStatus(`${importedSummaries.length} amostra(s) importada(s) com sucesso.`);
      }
    } catch (importError) {
      setTranscriptError(
        importError instanceof Error
          ? importError.message
          : "Nao foi possivel importar as fotos para o dataset.",
      );
      setCardDatasetStatus("A importacao falhou.");
    } finally {
      setIsImportingCardPhotos(false);
      if (datasetImportInputRef.current) {
        datasetImportInputRef.current.value = "";
      }
    }
  }

  function openDatasetImportPicker() {
    datasetImportInputRef.current?.click();
  }

  function openReplaceSelectedCardSamplePicker() {
    datasetReplaceInputRef.current?.click();
  }

  async function handleReplaceSelectedCardSampleFile(fileList: FileList | null) {
    if (!selectedCardSample || !fileList || fileList.length === 0) {
      return;
    }

    const file = fileList[0];

    try {
      setTranscriptError("");
      setCardDatasetStatus("Substituindo a imagem da amostra selecionada...");
      const image = await loadImageFromFile(file);
      const summary = await replaceSavedCardSampleBlob(selectedCardSample.id, {
        blob: file,
        width: image.naturalWidth,
        height: image.naturalHeight,
        sourceImageName: file.name,
      });

      setSelectedCardSampleUrl("");
      await refreshSavedCardSamples();
      setSelectedCardSampleId(summary.id);
      setSelectedCardSampleBlobVersion((current) => current + 1);
      setCardDatasetStatus("Imagem da amostra substituida com sucesso.");
    } catch (error) {
      setTranscriptError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel substituir a imagem da amostra.",
      );
      setCardDatasetStatus("Nao foi possivel substituir a imagem da amostra.");
    } finally {
      if (datasetReplaceInputRef.current) {
        datasetReplaceInputRef.current.value = "";
      }
    }
  }

  async function detectCardBoxesFromPhoto(image: HTMLImageElement) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Nao foi possivel preparar o canvas da foto importada.");
    }

    context.drawImage(image, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    const totalPixels = width * height;
    const visited = new Uint8Array(totalPixels);
    const mask = new Uint8Array(totalPixels);

    for (let index = 0; index < totalPixels; index += 1) {
      const rgbaIndex = index * 4;
      const red = data[rgbaIndex];
      const green = data[rgbaIndex + 1];
      const blue = data[rgbaIndex + 2];
      const gray = Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
      const maxChannel = Math.max(red, green, blue);
      const minChannel = Math.min(red, green, blue);
      const spread = maxChannel - minChannel;

      if (gray >= 140 && spread <= 175) {
        mask[index] = 1;
      }
    }

    const rawBoxes: PhotoCardImportBox[] = [];

    for (let index = 0; index < totalPixels; index += 1) {
      if (visited[index] === 1 || mask[index] === 0) {
        continue;
      }

      const box = floodFillImportedCard({
        mask,
        visited,
        startIndex: index,
        width,
        height,
      });

      if (!box) {
        continue;
      }

      const areaRatio = (box.width * box.height) / Math.max(width * height, 1);
      const aspectRatio = box.width / Math.max(box.height, 1);
      const relativeHeight = box.height / Math.max(height, 1);

      if (
        areaRatio < 0.004 ||
        areaRatio > 0.05 ||
        aspectRatio < 0.34 ||
        aspectRatio > 0.95 ||
        relativeHeight < 0.12
      ) {
        continue;
      }

      rawBoxes.push(box);
    }

    const boxes = resolveImportedPhotoBoxes(rawBoxes, width, height);

    if (boxes.length === 0) {
      throw new Error(
        "Nao foi possivel localizar a carta nessa foto. Tente uma imagem mais nítida ou com a carta mais centralizada.",
      );
    }

    return boxes;
  }

  async function detectCardBoxesFromPhotoWithFallback(image: HTMLImageElement) {
    try {
      const detectedBoxes = await detectCardBoxesFromPhoto(image);

      if (detectedBoxes.length > 0) {
        return detectedBoxes;
      }
    } catch {
      // A fallback central ajuda fotos individuais quando o detector falha.
    }

    return [buildFallbackSingleCardBox(image)];
  }

  function buildFallbackSingleCardBox(image: HTMLImageElement): PhotoCardImportBox {
    const imageWidth = image.naturalWidth;
    const imageHeight = image.naturalHeight;
    const fallbackWidth = Math.max(1, Math.round(imageWidth * 0.52));
    const fallbackHeight = Math.max(1, Math.round(imageHeight * 0.72));
    const x = Math.max(0, Math.round((imageWidth - fallbackWidth) / 2));
    const y = Math.max(0, Math.round((imageHeight - fallbackHeight) / 2));

    return {
      x,
      y,
      width: Math.min(fallbackWidth, imageWidth - x),
      height: Math.min(fallbackHeight, imageHeight - y),
    };
  }

  function floodFillImportedCard({
    mask,
    visited,
    startIndex,
    width,
    height,
  }: {
    mask: Uint8Array;
    visited: Uint8Array;
    startIndex: number;
    width: number;
    height: number;
  }) {
    const queue = [startIndex];
    let head = 0;
    visited[startIndex] = 1;

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let pixelCount = 0;

    while (head < queue.length) {
      const currentIndex = queue[head];
      head += 1;
      const x = currentIndex % width;
      const y = Math.floor(currentIndex / width);
      pixelCount += 1;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      for (const offset of [-1, 1, -width, width]) {
        const neighbor = currentIndex + offset;

        if (neighbor < 0 || neighbor >= mask.length || visited[neighbor] === 1) {
          continue;
        }

        const neighborX = neighbor % width;
        const neighborY = Math.floor(neighbor / width);

        if (Math.abs(neighborX - x) + Math.abs(neighborY - y) !== 1) {
          continue;
        }

        if (mask[neighbor] === 0) {
          continue;
        }

        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }

    if (pixelCount < 200) {
      return null;
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  function dedupeImportedBoxes(boxes: PhotoCardImportBox[]) {
    const sortedBoxes = [...boxes].sort(
      (left, right) => left.width * left.height - right.width * right.height,
    );
    const keptBoxes: PhotoCardImportBox[] = [];

    for (const box of sortedBoxes) {
      const overlaps = keptBoxes.some((candidate) => importedIntersectionRatio(box, candidate) > 0.7);

      if (!overlaps) {
        keptBoxes.push(box);
      }
    }

    return keptBoxes;
  }

  function importedIntersectionRatio(left: PhotoCardImportBox, right: PhotoCardImportBox) {
    const xOverlap = Math.max(
      0,
      Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
    );
    const yOverlap = Math.max(
      0,
      Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y),
    );
    const intersectionArea = xOverlap * yOverlap;

    if (intersectionArea <= 0) {
      return 0;
    }

    const minArea = Math.min(left.width * left.height, right.width * right.height);
    return intersectionArea / Math.max(minArea, 1);
  }

  function orderImportedBoxes(boxes: PhotoCardImportBox[]) {
    const averageHeight =
      boxes.reduce((total, box) => total + box.height, 0) / Math.max(boxes.length, 1);
    const sortedByY = [...boxes].sort(
      (left, right) => left.y + left.height / 2 - (right.y + right.height / 2),
    );
    const rows: PhotoCardImportBox[][] = [];

    for (const box of sortedByY) {
      const centerY = box.y + box.height / 2;
      const lastRow = rows.at(-1);

      if (!lastRow) {
        rows.push([box]);
        continue;
      }

      const rowCenterY =
        lastRow.reduce((total, candidate) => total + candidate.y + candidate.height / 2, 0) /
        Math.max(lastRow.length, 1);

      if (Math.abs(centerY - rowCenterY) <= averageHeight * 0.65) {
        lastRow.push(box);
      } else {
        rows.push([box]);
      }
    }

    return rows
      .map((row) => row.sort((left, right) => left.x - right.x))
      .flat()
      .map((box) => {
        const paddingX = Math.max(4, Math.round(box.width * 0.06));
        const paddingY = Math.max(4, Math.round(box.height * 0.06));

        return {
          x: Math.max(0, box.x - paddingX),
          y: Math.max(0, box.y - paddingY),
          width: box.width + paddingX * 2,
          height: box.height + paddingY * 2,
        };
      });
  }

  function resolveImportedPhotoBoxes(
    rawBoxes: PhotoCardImportBox[],
    imageWidth: number,
    imageHeight: number,
  ) {
    const dedupedBoxes = dedupeImportedBoxes(rawBoxes)
      .sort((left, right) => right.width * right.height - left.width * left.height)
      .slice(0, 12);

    if (dedupedBoxes.length === 0) {
      return [];
    }

    if (shouldPreferSingleImportedCardMode(dedupedBoxes, imageWidth, imageHeight)) {
      const seed = [...dedupedBoxes].sort(
        (left, right) =>
          scoreImportedSingleCardBox(right, imageWidth, imageHeight) -
          scoreImportedSingleCardBox(left, imageWidth, imageHeight),
      )[0];

      const merged = mergeImportedBoxesNearSeed(seed, dedupedBoxes, imageWidth, imageHeight);
      return [expandImportedBox(merged, imageWidth, imageHeight)];
    }

    return orderImportedBoxes(dedupedBoxes.slice(0, 10));
  }

  function shouldPreferSingleImportedCardMode(
    boxes: PhotoCardImportBox[],
    imageWidth: number,
    imageHeight: number,
  ) {
    if (boxes.length <= 4) {
      return true;
    }

    const [largest, secondLargest] = [...boxes].sort(
      (left, right) => right.width * right.height - left.width * left.height,
    );

    if (!largest) {
      return false;
    }

    const largestArea = largest.width * largest.height;
    const secondArea = secondLargest ? secondLargest.width * secondLargest.height : 1;
    const largestCenterX = largest.x + largest.width / 2;
    const largestCenterY = largest.y + largest.height / 2;
    const centerDistance = Math.hypot(
      largestCenterX - imageWidth / 2,
      largestCenterY - imageHeight / 2,
    );
    const maxCenterDistance = Math.hypot(imageWidth / 2, imageHeight / 2);

    return largestArea >= secondArea * 1.45 && centerDistance <= maxCenterDistance * 0.28;
  }

  function scoreImportedSingleCardBox(
    box: PhotoCardImportBox,
    imageWidth: number,
    imageHeight: number,
  ) {
    const areaScore = (box.width * box.height) / Math.max(imageWidth * imageHeight, 1);
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const centerDistance = Math.hypot(centerX - imageWidth / 2, centerY - imageHeight / 2);
    const centerScore = 1 - centerDistance / Math.max(Math.hypot(imageWidth / 2, imageHeight / 2), 1);
    const aspectRatio = box.width / Math.max(box.height, 1);
    const aspectScore = 1 - Math.min(Math.abs(aspectRatio - 0.62), 0.35) / 0.35;

    return areaScore * 0.55 + centerScore * 0.25 + aspectScore * 0.2;
  }

  function mergeImportedBoxesNearSeed(
    seed: PhotoCardImportBox,
    boxes: PhotoCardImportBox[],
    imageWidth: number,
    imageHeight: number,
  ) {
    let merged = { ...seed };
    const toleranceX = Math.max(24, Math.round(seed.width * 0.55));
    const toleranceY = Math.max(24, Math.round(seed.height * 0.55));

    for (const box of boxes) {
      const overlapsExpandedSeed =
        box.x <= merged.x + merged.width + toleranceX &&
        box.x + box.width >= merged.x - toleranceX &&
        box.y <= merged.y + merged.height + toleranceY &&
        box.y + box.height >= merged.y - toleranceY;

      if (!overlapsExpandedSeed) {
        continue;
      }

      merged = {
        x: Math.min(merged.x, box.x),
        y: Math.min(merged.y, box.y),
        width: Math.max(merged.x + merged.width, box.x + box.width) - Math.min(merged.x, box.x),
        height:
          Math.max(merged.y + merged.height, box.y + box.height) - Math.min(merged.y, box.y),
      };
    }

    return expandImportedBox(merged, imageWidth, imageHeight);
  }

  function expandImportedBox(
    box: PhotoCardImportBox,
    imageWidth: number,
    imageHeight: number,
  ) {
    const paddingX = Math.max(8, Math.round(box.width * 0.08));
    const paddingY = Math.max(8, Math.round(box.height * 0.08));
    const x = Math.max(0, box.x - paddingX);
    const y = Math.max(0, box.y - paddingY);
    const right = Math.min(imageWidth, box.x + box.width + paddingX);
    const bottom = Math.min(imageHeight, box.y + box.height + paddingY);

    return {
      x,
      y,
      width: Math.max(1, right - x),
      height: Math.max(1, bottom - y),
    };
  }

  async function cropPhotoCardToBlob(image: HTMLImageElement, box: PhotoCardImportBox) {
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = Math.max(1, box.width);
    cropCanvas.height = Math.max(1, box.height);

    const cropContext = cropCanvas.getContext("2d");

    if (!cropContext) {
      throw new Error("Nao foi possivel preparar o recorte da foto importada.");
    }

    cropContext.drawImage(
      image,
      box.x,
      box.y,
      box.width,
      box.height,
      0,
      0,
      cropCanvas.width,
      cropCanvas.height,
    );

    return await new Promise<Blob | null>((resolve) => {
      cropCanvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  function loadImageFromFile(file: File) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Nao foi possivel abrir a foto ${file.name}.`));
      };

      image.src = objectUrl;
    });
  }

  function measureBoardDetectionSimilarity(
    currentDetection: BoardDetectionResult,
    nextDetection: BoardDetectionResult,
  ) {
    if (
      currentDetection.cardCount === 0 ||
      nextDetection.cardCount === 0 ||
      currentDetection.boxes.length !== nextDetection.boxes.length
    ) {
      return 0;
    }

    const currentBoxes = [...currentDetection.boxes].sort((left, right) => left.x - right.x);
    const nextBoxes = [...nextDetection.boxes].sort((left, right) => left.x - right.x);
    let total = 0;

    for (let index = 0; index < currentBoxes.length; index += 1) {
      total += importedIntersectionRatio(currentBoxes[index], nextBoxes[index]);
    }

    return total / Math.max(currentBoxes.length, 1);
  }

  function buildBoardGeometrySignature(detection: BoardDetectionResult) {
    return detection.boxes
      .map((box) =>
        [
          Math.round(box.x / 5),
          Math.round(box.y / 5),
          Math.round(box.width / 5),
          Math.round(box.height / 5),
        ].join(":"),
      )
      .join("|");
  }

  function stabilizeBoardDetection(nextDetection: BoardDetectionResult) {
    const currentDetection = latestBoardDetectionRef.current;

    if (!currentDetection) {
      pendingLowerBoardDetectionRef.current = null;
      pendingSameCountBoardDetectionRef.current = null;
      return nextDetection;
    }

    if (nextDetection.cardCount > currentDetection.cardCount) {
      pendingLowerBoardDetectionRef.current = null;
      pendingSameCountBoardDetectionRef.current = null;
      return nextDetection;
    }

    if (nextDetection.cardCount === currentDetection.cardCount) {
      pendingLowerBoardDetectionRef.current = null;

      if (nextDetection.cardCount === 0) {
        pendingSameCountBoardDetectionRef.current = null;
        return nextDetection;
      }

      const similarity = measureBoardDetectionSimilarity(currentDetection, nextDetection);

      if (similarity >= 0.34) {
        pendingSameCountBoardDetectionRef.current = null;
        return nextDetection;
      }

      const signature = buildBoardGeometrySignature(nextDetection);
      const pendingSameCount = pendingSameCountBoardDetectionRef.current;

      if (pendingSameCount && pendingSameCount.signature === signature) {
        pendingSameCount.streak += 1;

        if (pendingSameCount.streak >= 4) {
          pendingSameCountBoardDetectionRef.current = null;
          return pendingSameCount.detection;
        }
      } else {
        pendingSameCountBoardDetectionRef.current = {
          signature,
          streak: 1,
          detection: nextDetection,
        };
      }

      return {
        ...currentDetection,
        detectedAt: nextDetection.detectedAt,
        diffScore: nextDetection.diffScore,
      };
    }

    let requiredStreak = nextDetection.cardCount === 0 ? 4 : 5;

    if (currentDetection.cardCount >= 3 && nextDetection.cardCount > 0) {
      requiredStreak = 8;
    }

    if (currentDetection.cardCount >= 4 && nextDetection.cardCount >= 3) {
      requiredStreak = 10;
    }

    const currentPending = pendingLowerBoardDetectionRef.current;
    pendingSameCountBoardDetectionRef.current = null;

    if (currentPending && currentPending.cardCount === nextDetection.cardCount) {
      currentPending.streak += 1;

      if (currentPending.streak >= requiredStreak) {
        pendingLowerBoardDetectionRef.current = null;
        return nextDetection;
      }
    } else {
      pendingLowerBoardDetectionRef.current = {
        cardCount: nextDetection.cardCount,
        streak: 1,
      };
    }

    return {
      ...currentDetection,
      detectedAt: nextDetection.detectedAt,
      diffScore: nextDetection.diffScore,
    };
  }

  async function startBoardMonitor(
    options: {
      skipPreviewCheck?: boolean;
      silent?: boolean;
    } = {},
  ) {
    try {
      setTranscriptError("");
      setError("");

      const ready = options.skipPreviewCheck ? Boolean(streamRef.current) : await ensurePreviewReady();

      if (!ready) {
        throw new Error("Nao foi possivel preparar o preview para monitorar o board.");
      }

      if (boardMonitorStatus === "monitoring" || boardMonitorStatus === "loading") {
        return;
      }

      setBoardMonitorStatus("loading");
      setBoardRuntimeLabel("Preparando worker do board...");
      await runBoardDetection("monitor");

      setBoardMonitorStatus("monitoring");
      boardMonitorLoopIdRef.current += 1;
      void runBoardMonitorLoop(boardMonitorLoopIdRef.current);
    } catch (boardError) {
      setBoardMonitorStatus("idle");
      setBoardRuntimeLabel("Worker do board indisponivel");
      setTranscriptError(
        boardError instanceof Error
          ? boardError.message
          : "Nao foi possivel iniciar o monitoramento do board.",
      );
    }
  }

  async function runBoardMonitorLoop(loopId: number) {
    while (boardMonitorLoopIdRef.current === loopId) {
      const intervalMs = activeHandRef.current
        ? BOARD_MONITOR_ACTIVE_INTERVAL_MS
        : BOARD_MONITOR_IDLE_INTERVAL_MS;

      if (document.visibilityState === "hidden" || captureStatus !== "preview" || !isVideoEnabled) {
        await wait(intervalMs);
        continue;
      }

      if (!isBoardDetectionRunningRef.current) {
        try {
          isBoardDetectionRunningRef.current = true;
          await runBoardDetection("monitor");
        } catch (monitorError) {
          setTranscriptError(
            monitorError instanceof Error
              ? monitorError.message
              : "Falha ao analisar continuamente o board.",
          );
          stopBoardMonitor();
          return;
        } finally {
          isBoardDetectionRunningRef.current = false;
        }
      }

      await wait(intervalMs);
    }
  }

  function stopBoardMonitor() {
    boardMonitorLoopIdRef.current += 1;
    isBoardDetectionRunningRef.current = false;
    lastBoardSignatureRef.current = "";
    lastBoardCardCountRef.current = 0;
    pendingLowerBoardDetectionRef.current = null;
    boardWorkerRef.current?.postMessage({ type: "reset" });
    setBoardMonitorStatus("idle");
    setBoardRuntimeLabel("Worker do board em espera");
  }

  async function handleOpenSavedVideo(videoId: string) {
    try {
      const blob = await getSavedHandClipBlob(videoId);

      if (!blob) {
        throw new Error("Nao foi possivel carregar o video salvo.");
      }

      if (selectedVideoUrl) {
        URL.revokeObjectURL(selectedVideoUrl);
      }

      setSelectedVideoId(videoId);
      setSelectedVideoUrl(URL.createObjectURL(blob));
      setActiveView("videos");
    } catch (openError) {
      setTranscriptError(
        openError instanceof Error
          ? openError.message
          : "Falha ao abrir o video salvo.",
      );
    }
  }

  async function handleDeleteSavedVideo(videoId: string) {
    try {
      await deleteSavedHandClip(videoId);
      if (selectedVideoId === videoId) {
        if (selectedVideoUrl) {
          URL.revokeObjectURL(selectedVideoUrl);
        }
        setSelectedVideoId("");
        setSelectedVideoUrl("");
      }
      await refreshSavedVideos();
    } catch (deleteError) {
      setTranscriptError(
        deleteError instanceof Error
          ? deleteError.message
          : "Falha ao excluir o video salvo.",
      );
    }
  }

  async function persistCurrentSessionTranscript() {
    const startedAt = sessionTranscriptStartedAtRef.current;
    const lines = sessionTranscriptLinesRef.current;

    if (!startedAt || lines.length === 0) {
      return;
    }

    await saveSessionTranscript({
      title: linkedStageContext
        ? `${linkedStageContext.stageTitle} · ${linkedMatchLabel}`
        : `Sessao ${new Date(startedAt).toLocaleDateString("pt-BR")}`,
      startedAt,
      endedAt: new Date().toISOString(),
      lineCount: lines.length,
      content: lines.join("\n"),
      linkedStageId: linkedStageContext?.stageId ?? null,
      linkedStageTitle: linkedStageContext?.stageTitle ?? null,
      linkedMatchLabel,
      linkedBlindLabel: linkedStageContext?.currentBlindLabel ?? null,
    });

    sessionTranscriptStartedAtRef.current = "";
    sessionTranscriptLinesRef.current = [];
    await refreshSavedTranscripts();
  }

  function shouldPersistTranscriptLine({
    source,
    normalized,
    cleanText,
  }: {
    source: "browser" | "whisper";
    normalized: string;
    cleanText: string;
  }) {
    if (!cleanText || !normalized) {
      return false;
    }

    if (source === "browser") {
      return false;
    }

    if (!looksLikeTableSpeech(cleanText, normalized)) {
      return false;
    }

    const now = Date.now();
    const recent = recentTranscriptSignaturesRef.current.filter((entry) => now - entry.at < 8000);
    recentTranscriptSignaturesRef.current = recent;

    const duplicate = recent.some((entry) => {
      if (entry.key === normalized) {
        return true;
      }

      if (
        normalized.length >= 12 &&
        (entry.key.includes(normalized) || normalized.includes(entry.key))
      ) {
        return true;
      }

      return false;
    });

    if (duplicate) {
      return false;
    }

    recentTranscriptSignaturesRef.current = [
      ...recentTranscriptSignaturesRef.current,
      { key: normalized, at: now },
    ];
    return true;
  }

  function updateBoardRegion<K extends keyof BoardRegion>(key: K, value: number) {
    setBoardRegion((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function saveBoardRegion() {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(BOARD_REGION_STORAGE_KEY, JSON.stringify(boardRegion));
    setHasSavedBoardRegion(true);
    setError("");
  }

  function restoreSavedBoardRegion() {
    if (typeof window === "undefined") {
      return;
    }

    const storedBoardRegionValue = window.localStorage.getItem(BOARD_REGION_STORAGE_KEY);

    if (!storedBoardRegionValue) {
      setError("Ainda nao existe uma posicao salva para o board neste navegador.");
      return;
    }

    try {
      const parsedBoardRegion = JSON.parse(storedBoardRegionValue) as BoardRegion;
      setBoardRegion(parsedBoardRegion);
      setHasSavedBoardRegion(true);
      setError("");
    } catch {
      window.localStorage.removeItem(BOARD_REGION_STORAGE_KEY);
      setHasSavedBoardRegion(false);
      setError("A posicao salva do board estava invalida e foi limpa.");
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,190,65,0.16),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(255,190,65,0.18),transparent_24%),linear-gradient(180deg,#05140d_0%,#07160f_100%)] text-[rgba(255,247,224,0.96)]">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 pb-8 pt-24 md:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-[rgba(255,208,101,0.18)] bg-[linear-gradient(180deg,rgba(10,39,28,0.96),rgba(7,22,15,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[0.72rem] uppercase tracking-[0.28em] text-[rgba(240,227,189,0.56)]">
                {integratedMode ? "Modulo principal" : "Laboratorio separado"}
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.03em] text-[rgba(255,239,192,0.98)] md:text-5xl">
                {integratedMode ? "Transmissao ao vivo" : "Live Lab da Mesa"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[rgba(237,226,197,0.72)] md:text-base">
                {integratedMode
                  ? "Este modulo agora faz parte do fluxo principal da SHPL para gravar a transmissao, transcrever a mesa, recortar apenas as maos marcadas para salvar e enviar os TXT direto para as estatisticas."
                  : "Este modulo fica fora do fluxo principal da SHPL para testar camera do celular, audio da propria transmissao, cortes por mao e preparacao para a futura deteccao de flop, turn e river."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Status" value={captureStatusLabel} />
              <MetricCard label="Sessao" value={liveSessionStatusLabel} />
              <MetricCard label={integratedMode ? "Partida" : "Board"} value={integratedMode ? linkedMatchLabel : boardMonitorLabel} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <SubmenuCard
            active={activeView === "capture"}
            description={
              integratedMode
                ? "Use no celular ou aparelho que vai abrir a camera e enviar o preview da transmissao."
                : "Preview da camera, sessao continua e teste direto da transcricao."
            }
            label={integratedMode ? "Este aparelho transmite" : "Captura ao vivo"}
            onClick={integratedMode ? handleSelectCaptureMode : () => setActiveView("capture")}
          />
          <SubmenuCard
            active={activeView === "admin"}
            description={
              integratedMode
                ? "Use no PC ou segundo celular para monitorar a captura, controlar a sessao e revisar comandos."
                : "Comandos detectados, maos abertas e supervisao da gravacao local."
            }
            label={integratedMode ? "Este aparelho monitora" : "Administracao"}
            onClick={integratedMode ? handleSelectMonitorMode : () => setActiveView("admin")}
          />
          <SubmenuCard
            active={activeView === "videos"}
            description={integratedMode ? "Maos realmente salvas para revisar, assistir e enviar para analise." : "Lista dos cortes ja salvos para assistir, revisar e excluir."}
            label="Videos salvos"
            onClick={() => setActiveView("videos")}
          />
        </section>

        {activeView === "videos" ? (
          <section className="grid w-full max-w-full gap-6">
            <div className="w-full max-w-full overflow-hidden rounded-[2rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(8,28,20,0.92)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[rgba(240,227,189,0.5)]">
                    Biblioteca local
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-[rgba(255,239,192,0.96)]">
                    Videos salvos
                  </h2>
                </div>

                <ActionButton label="Atualizar lista" onClick={() => void refreshSavedVideos()} tone="muted" />
              </div>

              <div className="mt-5">
                {isLoadingSavedVideos ? (
                  <p className="text-sm text-[rgba(237,226,197,0.72)]">Carregando videos salvos...</p>
                  ) : savedVideos.length === 0 ? (
                    <div className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-5 text-sm leading-7 text-[rgba(237,226,197,0.68)]">
                      {integratedMode ? (
                        <>
                          Ainda nao existe nenhuma mao salva. O modulo so persiste o clip quando a mao recebe o comando
                          <strong className="text-[rgba(255,236,184,0.92)]"> salvar essa mao</strong>.
                        </>
                      ) : (
                        <>
                          Ainda nao existe nenhum corte salvo. Assim que a sessao detectar os comandos
                          <strong className="text-[rgba(255,236,184,0.92)]"> nova partida </strong>
                          e
                          <strong className="text-[rgba(255,236,184,0.92)]"> encerrar partida</strong>,
                          os clips vao aparecer aqui.
                        </>
                      )}
                    </div>
                  ) : (
                  <div className="w-full max-w-full overflow-x-auto pb-3">
                    <div className="flex w-max min-w-full gap-4">
                      {savedVideos.map((video) => (
                        <article
                          key={video.id}
                          className="w-[280px] shrink-0 rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-lg font-bold text-[rgba(255,239,192,0.96)]">{video.title}</p>
                              <p className="mt-2 text-sm text-[rgba(237,226,197,0.68)]">
                                {formatDateTime(video.startedAt)} ate {formatDateTime(video.endedAt)}
                              </p>
                            </div>
                            <span className="rounded-full border border-[rgba(255,208,101,0.14)] px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[rgba(255,236,184,0.9)]">
                              {formatDuration(video.durationSeconds)}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-2 text-sm text-[rgba(237,226,197,0.72)]">
                            <InfoLine label="Inicio detectado" value={video.startTrigger} />
                            <InfoLine label="Fim detectado" value={video.endTrigger} />
                            <InfoLine label="Tamanho" value={formatBytes(video.sizeBytes)} />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-3">
                            <ActionButton
                              label="Assistir"
                              onClick={() => void handleOpenSavedVideo(video.id)}
                              tone="accent"
                            />
                            <ActionButton
                              label="Excluir"
                              onClick={() => void handleDeleteSavedVideo(video.id)}
                              tone="muted"
                            />
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full max-w-full overflow-hidden rounded-[2rem] border border-[rgba(255,208,101,0.18)] bg-[rgba(8,28,20,0.92)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
              <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[rgba(240,227,189,0.5)]">
                Visualizacao
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[rgba(255,239,192,0.96)]">
                Reprodutor local
              </h2>

              <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(2,10,7,0.95)]">
                {selectedVideoUrl ? (
                  <video
                    key={selectedVideoUrl}
                    className="aspect-video w-full bg-black object-contain"
                    controls
                    preload="metadata"
                    src={selectedVideoUrl}
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center px-6 text-center text-sm leading-7 text-[rgba(237,226,197,0.68)]">
                    Selecione um video salvo para assistir por aqui.
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : activeView === "capture" ? (
        <section className="rounded-[2rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(8,28,20,0.92)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[rgba(240,227,189,0.5)]">
                  Preview ao vivo
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[rgba(255,239,192,0.96)]">
                  Camera + microfone da live
                </h2>
              </div>

              <div className="flex flex-wrap gap-3">
                <ActionButton
                  disabled={liveSessionStatus === "running"}
                  label={liveSessionStatus === "paused" ? "Retomar sessao continua" : "Iniciar sessao continua"}
                  onClick={() => void startLiveSession()}
                  tone="accent"
                />
                <ActionButton
                  disabled={liveSessionStatus === "idle"}
                  label={liveSessionStatus === "paused" ? "Retomar sessao continua" : "Pausar sessao continua"}
                  onClick={() => {
                    if (liveSessionStatus === "paused") {
                      void startLiveSession();
                      return;
                    }

                    pauseLiveSession();
                  }}
                  tone="muted"
                />
                <ActionButton
                  disabled={liveSessionStatus === "idle"}
                  label="Finalizar sessao continua"
                  onClick={() => void stopLiveSession()}
                  tone="muted"
                />
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(2,10,7,0.95)]">
              <div className="relative aspect-video w-full">
                <video
                  ref={videoRef}
                  autoPlay
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                />

                {activeHandTitle ? (
                  <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-3 rounded-full border border-[rgba(255,122,122,0.28)] bg-[rgba(89,10,10,0.72)] px-4 py-2 shadow-[0_12px_26px_rgba(0,0,0,0.28)] backdrop-blur-sm">
                    <span className="relative flex h-4 w-4">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[rgba(255,78,78,0.62)]" />
                      <span className="relative inline-flex h-4 w-4 rounded-full bg-[#ff4f4f]" />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[rgba(255,228,228,0.82)]">
                        Gravando mao
                      </span>
                      <span className="text-sm font-semibold text-[rgba(255,245,245,0.96)]">
                        {activeHandTitle}
                      </span>
                    </div>
                  </div>
                ) : null}

                {captureStatus === "idle" ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-[rgba(2,10,7,0.72)]">
                    <div className="rounded-[1.4rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(8,29,21,0.92)] px-5 py-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[rgba(255,236,184,0.74)]">
                        Preview desligado
                      </p>
                      <p className="mt-2 text-sm text-[rgba(237,226,197,0.68)]">
                        A tela tenta iniciar o preview automaticamente assim que a camera estiver disponivel.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <ActionButton label="Parar preview" onClick={stopStream} tone="muted" />
            </div>

            {integratedMode ? (
              <div className="mt-4 rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <MetricCard label="Etapa vinculada" value={linkedStageTitle} />
                  <MetricCard label="Partida ativa" value={linkedMatchLabel} />
                  <MetricCard label="Blind atual" value={linkedBlindLabel} />
                  <MetricCard label="Modo" value="Fonte de captura" />
                </div>

                <p className="mt-4 rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(4,17,12,0.62)] px-4 py-3 text-sm text-[rgba(237,226,197,0.76)]">
                  Ponte remota: {remoteBridgeStatus}
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-[1rem] border border-[rgba(255,129,129,0.22)] bg-[rgba(106,24,24,0.34)] px-4 py-3 text-sm text-[rgba(255,220,220,0.96)]">
                {error}
              </p>
            ) : null}

            {transcriptError ? (
              <p className="mt-4 rounded-[1rem] border border-[rgba(255,129,129,0.22)] bg-[rgba(106,24,24,0.34)] px-4 py-3 text-sm text-[rgba(255,220,220,0.96)]">
                {transcriptError}
              </p>
            ) : null}
          </section>
        ) : null}

        {activeView === "admin" ? (
          <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="grid gap-6">
              <section className="rounded-[2rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(8,28,20,0.92)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[rgba(240,227,189,0.5)]">
                      Preview ao vivo
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-[rgba(255,239,192,0.96)]">
                      Visualizacao da captura
                    </h2>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <ActionButton
                      disabled={liveSessionStatus === "running"}
                      label={liveSessionStatus === "paused" ? "Retomar sessao continua" : "Iniciar sessao continua"}
                      onClick={() => void startLiveSession()}
                      tone="accent"
                    />
                    <ActionButton
                      disabled={liveSessionStatus === "idle"}
                      label={liveSessionStatus === "paused" ? "Retomar sessao continua" : "Pausar sessao continua"}
                      onClick={() => {
                        if (liveSessionStatus === "paused") {
                          void startLiveSession();
                          return;
                        }

                        pauseLiveSession();
                      }}
                      tone="muted"
                    />
                    <ActionButton
                      disabled={liveSessionStatus === "idle"}
                      label="Finalizar sessao continua"
                      onClick={() => void stopLiveSession()}
                      tone="muted"
                    />
                    <ActionButton label="Parar preview" onClick={stopStream} tone="muted" />
                    {integratedMode ? (
                      <ActionButton
                        label={
                          deviceRole === "camera"
                            ? "Voltar para monitorar"
                            : "Este aparelho tambem transmite"
                        }
                        onClick={
                          deviceRole === "camera"
                            ? handleSelectMonitorMode
                            : handleEnableLocalCaptureFromAdmin
                        }
                        tone={deviceRole === "camera" ? "muted" : "accent"}
                      />
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(2,10,7,0.95)]">
                  <div className="relative aspect-video w-full">
                    <video
                      ref={adminVideoRef}
                      autoPlay
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />

                    {boardFeaturesEnabled ? (
                      <div
                        className="pointer-events-none absolute rounded-[1rem] border-2 border-[rgba(255,204,98,0.95)] bg-[rgba(255,204,98,0.08)] shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]"
                        style={{
                          left: `${boardRegion.x}%`,
                          top: `${boardRegion.y}%`,
                          width: `${boardRegion.width}%`,
                          height: `${boardRegion.height}%`,
                        }}
                      />
                    ) : null}

                {captureStatus === "idle" ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-[rgba(2,10,7,0.72)]">
                    <div className="rounded-[1.4rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(8,29,21,0.92)] px-5 py-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[rgba(255,236,184,0.74)]">
                        Preview desligado
                      </p>
                      <p className="mt-2 text-sm text-[rgba(237,226,197,0.68)]">
                        {isRemoteMonitor
                          ? "Este dispositivo esta aguardando a fonte de captura transmitir o preview remoto."
                          : "A tela tenta iniciar o preview automaticamente assim que a camera estiver disponivel."}
                      </p>
                    </div>
                  </div>
                ) : null}
                  </div>
                </div>
              </section>

              <section className="rounded-[2rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(8,28,20,0.92)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
                <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[rgba(240,227,189,0.5)]">
                  Dispositivos
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[rgba(255,239,192,0.96)]">
                  Camera e audio da captura
                </h2>

                <div className="mt-5 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                      label="Sessao continua"
                      value={
                        liveSessionStatus === "running"
                          ? "Escutando comandos"
                          : liveSessionStatus === "paused"
                            ? "Pausada"
                            : "Desligada"
                      }
                    />
                    <MetricCard label="Mao aberta" value={activeHandTitle || "Nenhuma"} />
                    <MetricCard
                      label="Inicio da mao"
                      value={activeHandStartedAtIso ? formatTimeOnly(activeHandStartedAtIso) : "--:--:--"}
                    />
                  </div>

                  <p className="rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgba(237,226,197,0.76)]">
                    Motor de comando: {commandEngineLabel}
                  </p>

                  {integratedMode ? (
                    <div className="rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(4,17,12,0.62)] p-4">
                      <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[rgba(240,227,189,0.48)]">
                        Vínculo da transmissão
                      </p>
                      <div className="mt-3 grid gap-4 md:grid-cols-3">
                        <InfoLine label="Etapa" value={linkedStageTitle} />
                        <InfoLine label="Partida" value={linkedMatchLabel} />
                        <InfoLine label="Blind" value={linkedBlindLabel} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {linkedSeatSummaries.length === 0 ? (
                          <span className="text-sm text-[rgba(237,226,197,0.72)]">
                            Nenhum assento confirmado ainda. A transmissao vai puxar os lugares assim que a mesa salvar a partida atual.
                          </span>
                        ) : (
                          linkedSeatSummaries.map((seat) => (
                            <span
                              key={`admin-seat-${seat.seatIndex}`}
                              className="rounded-full border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs uppercase tracking-[0.16em] text-[rgba(255,239,192,0.92)]"
                            >
                              Lugar {seat.seatIndex + 1}: {seat.playerName}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}

                  {(!integratedMode || deviceRole === "camera") ? (
                    <>
                      <label className="grid gap-2">
                        <span className="text-sm font-semibold text-[rgba(255,239,192,0.92)]">
                          Camera
                        </span>
                        <select
                          className="rounded-[1rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(4,17,12,0.86)] px-4 py-3 text-sm text-[rgba(255,247,224,0.95)] outline-none transition focus:border-[rgba(255,208,101,0.34)]"
                          disabled={isLoadingDevices || videoDevices.length === 0}
                          onChange={(event) => setSelectedVideoDeviceId(event.target.value)}
                          value={selectedVideoDeviceId}
                        >
                          {videoDevices.map((device) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2">
                        <span className="text-sm font-semibold text-[rgba(255,239,192,0.92)]">
                          Microfone
                        </span>
                        <select
                          className="rounded-[1rem] border border-[rgba(255,208,101,0.16)] bg-[rgba(4,17,12,0.86)] px-4 py-3 text-sm text-[rgba(255,247,224,0.95)] outline-none transition focus:border-[rgba(255,208,101,0.34)]"
                          disabled={isLoadingDevices || audioDevices.length === 0}
                          onChange={(event) => setSelectedAudioDeviceId(event.target.value)}
                          value={selectedAudioDeviceId}
                        >
                          {audioDevices.map((device) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <ToggleCard
                          description="Mantem a camera da live ligada para o preview e os futuros cortes."
                          isActive={isVideoEnabled}
                          label="Video ativo"
                          onToggle={() => setIsVideoEnabled((current) => !current)}
                        />
                        <ToggleCard
                          description="Usa o audio da propria camera para a transcricao continua da sessao."
                          isActive={isAudioEnabled}
                          label="Audio ativo"
                          onToggle={() => setIsAudioEnabled((current) => !current)}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm leading-7 text-[rgba(237,226,197,0.72)]">
                      Este aparelho esta em modo monitor. A camera e o microfone locais ficam em espera, e o preview aparece assim que a fonte de captura publicar o sinal remoto.
                    </div>
                  )}

                  {integratedMode ? (
                    <p className="rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgba(237,226,197,0.76)]">
                      Ponte remota: {remoteBridgeStatus}
                    </p>
                  ) : null}
                </div>
              </section>
            </div>

            {integratedMode ? (
              <section className="rounded-[2rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(8,28,20,0.92)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
                <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[rgba(240,227,189,0.5)]">
                  Integracao com a mesa
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[rgba(255,239,192,0.96)]">
                  Dados herdados da partida
                </h2>
                <p className="mt-3 text-sm leading-7 text-[rgba(237,226,197,0.72)]">
                  O modulo principal usa a etapa vinculada para preencher blind, lugares e numero da partida no TXT da live. A deteccao visual do board continua em standby no laboratorio separado.
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <MetricCard label="Etapa" value={linkedStageTitle} />
                  <MetricCard label="Partida atual" value={linkedMatchLabel} />
                  <MetricCard label="Blind da mesa" value={linkedBlindLabel} />
                </div>

                <div className="mt-5 rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(4,17,12,0.62)] p-4">
                  <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[rgba(240,227,189,0.48)]">
                    Comandos ativos na live
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["nova partida", "encerrar partida", "salvar essa mao"].map((command) => (
                      <span
                        key={command}
                        className="rounded-full border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs uppercase tracking-[0.16em] text-[rgba(255,239,192,0.92)]"
                      >
                        {command}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[rgba(237,226,197,0.72)]">
                    No fluxo principal, a sessao grava continuamente em buffer e so salva o clipe quando a mao recebe o comando de voz para salvar.
                  </p>
                </div>

                <div className="mt-5 rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(4,17,12,0.62)] p-4">
                  <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[rgba(240,227,189,0.48)]">
                    Lugares da mesa
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {linkedSeatSummaries.length === 0 ? (
                      <div className="rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm leading-7 text-[rgba(237,226,197,0.68)] sm:col-span-2">
                        Nenhum lugar confirmado ainda para esta partida.
                      </div>
                    ) : (
                      linkedSeatSummaries.map((seat) => (
                        <div
                          key={`linked-seat-card-${seat.seatIndex}`}
                          className="rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-4"
                        >
                          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[rgba(240,227,189,0.48)]">
                            Lugar {seat.seatIndex + 1}
                          </p>
                          <p className="mt-2 text-base font-bold text-[rgba(255,239,192,0.96)]">
                            {seat.playerName}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-[2rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(8,28,20,0.92)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
                <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[rgba(240,227,189,0.5)]">
                  Monitoramento do board
                </p>
                <p className="mt-2 text-sm leading-6 text-[rgba(237,226,197,0.68)]">
                  Esta area mostra o board ao vivo durante o preview e serve para calibrar a deteccao de flop, turn e river em tempo real.
                </p>

                <div className="mt-4 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard label="Runtime CV" value={boardRuntimeLabel} />
                    <MetricCard
                      label="Estagio detectado"
                      value={boardDetection ? formatBoardStage(boardDetection.stage) : "Aguardando"}
                    />
                    <MetricCard
                      label="Cartas visiveis"
                      value={boardDetection ? String(boardDetection.cardCount) : "0"}
                    />
                  </div>
                  <SliderField
                    label="Posicao X"
                    onChange={(value) => updateBoardRegion("x", value)}
                    value={boardRegion.x}
                  />
                  <SliderField
                    label="Posicao Y"
                    onChange={(value) => updateBoardRegion("y", value)}
                    value={boardRegion.y}
                  />
                  <SliderField
                    label="Largura"
                    onChange={(value) => updateBoardRegion("width", value)}
                    value={boardRegion.width}
                  />
                  <SliderField
                    label="Altura"
                    onChange={(value) => updateBoardRegion("height", value)}
                    value={boardRegion.height}
                  />
                </div>

                <div className="mt-5 rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(4,17,12,0.86)] p-3">
                  <canvas
                    ref={snapshotCanvasRef}
                    className="mx-auto min-h-[120px] w-full rounded-[0.9rem] bg-[rgba(0,0,0,0.35)] object-contain"
                  />
                </div>

                <div className="mt-5 rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[rgba(240,227,189,0.5)]">
                        Identificacao das cartas
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[rgba(237,226,197,0.68)]">
                        Abaixo ficam as cartas detectadas no board e o status da leitura de cada uma.
                      </p>
                    </div>
                    <span className="rounded-full border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-[0.72rem] font-black uppercase tracking-[0.16em] text-[rgba(255,239,192,0.92)]">
                      {boardCardSummaries.length} carta(s)
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {boardCardSummaries.length === 0 ? (
                      <div className="rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(4,17,12,0.62)] px-4 py-4 text-sm leading-7 text-[rgba(237,226,197,0.68)]">
                        Assim que o board detectar cartas, a leitura vai aparecer aqui.
                      </div>
                    ) : (
                      boardCardSummaries.map((card) => (
                        <article
                          key={card.id}
                          className="rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(4,17,12,0.62)] px-4 py-4"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-bold text-[rgba(255,239,192,0.96)]">
                                Carta {card.index}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-[rgba(237,226,197,0.8)]">
                                {card.label}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span
                                className={`rounded-full px-3 py-1 text-[0.66rem] font-black uppercase tracking-[0.16em] ${
                                  card.status === "confirmada"
                                    ? "bg-[rgba(96,210,138,0.14)] text-[rgba(225,255,236,0.96)]"
                                    : "bg-[rgba(255,183,32,0.12)] text-[rgba(255,224,152,0.96)]"
                                }`}
                              >
                                {card.status === "confirmada" ? "Confirmada" : "Candidata"}
                              </span>
                              <span className="text-xs uppercase tracking-[0.16em] text-[rgba(240,227,189,0.48)]">
                                {card.confidence !== null ? `${card.confidence}%` : "sem score"}
                              </span>
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>

              <div className="hidden">
                <input
                  ref={datasetImportInputRef}
                  accept="image/*"
                  className="hidden"
                  multiple
                  onChange={(event) => {
                    void handleImportCardPhotoFiles(event.target.files);
                  }}
                  type="file"
                />
                <input
                  ref={datasetReplaceInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    void handleReplaceSelectedCardSampleFile(event.target.files);
                  }}
                  type="file"
                />

                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.72rem] uppercase tracking-[0.2em] text-[rgba(240,227,189,0.5)]">
                      Dataset local das cartas
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[rgba(237,226,197,0.68)]">
                      Salve os recortes detectados e va rotulando rank e naipe para
                      preparar o treino do classificador.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-[rgba(255,208,101,0.14)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-[0.72rem] font-black uppercase tracking-[0.16em] text-[rgba(255,239,192,0.92)]">
                      {savedCardSamples.length} amostra(s)
                    </span>
                    <ActionButton
                      label={isImportingCardPhotos ? "Importando fotos..." : "Importar fotos"}
                      onClick={openDatasetImportPicker}
                      tone="muted"
                      disabled={isImportingCardPhotos}
                    />
                    <ActionButton
                      label={isExportingCardDataset ? "Exportando dataset..." : "Exportar dataset"}
                      onClick={() => {
                        void exportLabeledCardDataset();
                      }}
                      tone="muted"
                      disabled={isExportingCardDataset || savedCardSamples.length === 0}
                    />
                    <ActionButton
                      label="Salvar cartas detectadas"
                      onClick={() => {
                        void saveCurrentBoardCardsToDataset();
                      }}
                      tone="accent"
                      disabled={boardCardSummaries.length === 0}
                    />
                  </div>
                </div>

                {cardDatasetStatus ? (
                  <div className="mt-4 rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(4,17,12,0.62)] px-4 py-4 text-sm leading-7 text-[rgba(237,226,197,0.76)]">
                    {cardDatasetStatus}
                  </div>
                ) : null}

                {isLoadingSavedCardSamples ? (
                  <div className="mt-4 rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(4,17,12,0.62)] px-4 py-4 text-sm leading-7 text-[rgba(237,226,197,0.68)]">
                    Carregando a base local das cartas...
                  </div>
                ) : savedCardSamples.length === 0 ? (
                  <div className="mt-4 rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(4,17,12,0.62)] px-4 py-4 text-sm leading-7 text-[rgba(237,226,197,0.68)]">
                    Assim que voce salvar cartas detectadas, elas vao aparecer aqui para
                    rotulagem e revisao.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                    <div className="grid max-h-[24rem] gap-3 overflow-y-auto pr-1">
                      {savedCardSamples.map((sample) => (
                        <button
                          key={sample.id}
                          className={`rounded-[1rem] border px-4 py-4 text-left transition ${
                            sample.id === selectedCardSampleId
                              ? "border-[rgba(255,208,101,0.28)] bg-[rgba(255,183,32,0.1)]"
                              : "border-[rgba(255,208,101,0.12)] bg-[rgba(4,17,12,0.62)]"
                          }`}
                          onClick={() => setSelectedCardSampleId(sample.id)}
                          type="button"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-bold text-[rgba(255,239,192,0.96)]">
                              {sample.rankLabel && sample.suitLabel
                                ? `${sample.rankLabel} de ${sample.suitLabel}`
                                : `Carta ${sample.sourceCardIndex}`}
                            </p>
                            <span className="text-[0.68rem] uppercase tracking-[0.18em] text-[rgba(240,227,189,0.48)]">
                              {formatBoardStage(sample.boardStage)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[rgba(237,226,197,0.72)]">
                            {sample.rankLabel && sample.suitLabel
                              ? "Rotulada e pronta para treino."
                              : "Ainda sem rotulagem manual."}
                          </p>
                          {sample.sourceImageName ? (
                            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[rgba(240,227,189,0.44)]">
                              {sample.sourceImageName}
                            </p>
                          ) : null}
                          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[rgba(255,208,101,0.82)]">
                            score {sample.confidence !== null ? `${Math.round(sample.confidence * 100)}%` : "n/d"}
                          </p>
                        </button>
                      ))}
                    </div>

                    <div className="rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(4,17,12,0.62)] p-4">
                      {selectedCardSample ? (
                        <>
                          <div className="overflow-hidden rounded-[1rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(0,0,0,0.35)]">
                            {selectedCardSampleUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                alt="Amostra de carta detectada"
                                className="h-[14rem] w-full object-contain"
                                src={selectedCardSampleUrl}
                              />
                            ) : (
                              <div className="flex h-[14rem] items-center justify-center text-sm text-[rgba(237,226,197,0.62)]">
                                Abrindo recorte da carta...
                              </div>
                            )}
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <label className="grid gap-2">
                              <span className="text-xs uppercase tracking-[0.18em] text-[rgba(240,227,189,0.48)]">
                                Rank
                              </span>
                              <select
                                className="rounded-[0.9rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.04)] px-3 py-3 text-sm text-[rgba(255,239,192,0.96)] outline-none"
                                onChange={(event) => {
                                  const nextRank = event.target.value || null;
                                  void saveSelectedCardSampleLabels(selectedCardSample.id, {
                                    rankLabel: nextRank,
                                    suitLabel: selectedCardSample.suitLabel,
                                  });
                                }}
                                value={selectedCardSample.rankLabel ?? ""}
                              >
                                <option value="">Nao rotulado</option>
                                {CARD_RANK_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="grid gap-2">
                              <span className="text-xs uppercase tracking-[0.18em] text-[rgba(240,227,189,0.48)]">
                                Naipe
                              </span>
                              <select
                                className="rounded-[0.9rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.04)] px-3 py-3 text-sm text-[rgba(255,239,192,0.96)] outline-none"
                                onChange={(event) => {
                                  const nextSuit = event.target.value || null;
                                  void saveSelectedCardSampleLabels(selectedCardSample.id, {
                                    rankLabel: selectedCardSample.rankLabel,
                                    suitLabel: nextSuit,
                                  });
                                }}
                                value={selectedCardSample.suitLabel ?? ""}
                              >
                                <option value="">Nao rotulado</option>
                                {CARD_SUIT_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <InfoLine
                              label="Capturada em"
                              value={formatDateTime(selectedCardSample.capturedAt)}
                            />
                            <InfoLine
                              label="Origem"
                              value={`${formatBoardStage(selectedCardSample.boardStage)} · carta ${selectedCardSample.sourceCardIndex} de ${selectedCardSample.sourceCardCount}`}
                            />
                            <InfoLine
                              label="Arquivo"
                              value={selectedCardSample.sourceImageName ?? "captura ao vivo"}
                            />
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <ActionButton
                              label="Substituir imagem"
                              onClick={openReplaceSelectedCardSamplePicker}
                              tone="accent"
                            />
                            <ActionButton
                              label="Excluir amostra"
                              onClick={() => {
                                void removeSelectedCardSample();
                              }}
                              tone="muted"
                            />
                            <span className="text-xs uppercase tracking-[0.16em] text-[rgba(240,227,189,0.48)]">
                              {selectedCardSample.rankLabel && selectedCardSample.suitLabel
                                ? "Amostra rotulada"
                                : "Amostra aguardando rotulagem"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-sm leading-7 text-[rgba(237,226,197,0.68)]">
                          Selecione uma amostra salva para revisar o recorte e rotular
                          rank e naipe.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden">
                O dataset local das cartas foi movido para <strong>Configuracoes &gt; Dataset local das cartas</strong>.
                Agora o gerenciamento de imagens, rotulos e exportacao do treino fica centralizado por la.
              </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <ActionButton label="Salvar board" onClick={saveBoardRegion} tone="accent" />
                  <ActionButton
                    label="Restaurar salvo"
                    onClick={restoreSavedBoardRegion}
                    tone="muted"
                    disabled={!hasSavedBoardRegion}
                  />
                  <span className="text-xs uppercase tracking-[0.16em] text-[rgba(240,227,189,0.48)]">
                    {hasSavedBoardRegion
                      ? "Board salvo neste navegador"
                      : "Nenhum board salvo ainda"}
                  </span>
                </div>
              </section>
            )}
          </section>
        ) : null}

        {activeView === "admin" ? (
          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(8,28,20,0.92)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
              <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[rgba(240,227,189,0.5)]">
                Administracao da sessao
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[rgba(255,239,192,0.96)]">
                Comandos detectados
              </h2>

              <div className="mt-5 grid gap-3">
                {transcriptFeed.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-5 text-sm leading-7 text-[rgba(237,226,197,0.68)]">
                    Assim que a sessao continua estiver ligada, as falas transcritas vao aparecer
                    aqui. O modulo reage a comandos como <strong>nova partida</strong>,
                    <strong> encerrar partida</strong> e <strong>salvar essa mao</strong>.
                  </div>
                ) : (
                  transcriptFeed.map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs uppercase tracking-[0.18em] text-[rgba(240,227,189,0.48)]">
                          {formatTimeOnly(entry.at)}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-[0.66rem] font-black uppercase tracking-[0.16em] ${
                            entry.command === "start"
                              ? "bg-[rgba(255,183,32,0.12)] text-[rgba(255,224,152,0.96)]"
                              : entry.command === "end"
                                ? "bg-[rgba(96,210,138,0.14)] text-[rgba(225,255,236,0.96)]"
                                : entry.command === "save"
                                  ? "bg-[rgba(129,196,255,0.14)] text-[rgba(220,239,255,0.96)]"
                                : "bg-[rgba(255,255,255,0.06)] text-[rgba(237,226,197,0.72)]"
                          }`}
                        >
                          {entry.command === "start"
                            ? "Iniciou mao"
                            : entry.command === "end"
                              ? "Encerrou mao"
                              : entry.command === "save"
                                ? "Salvar clip"
                              : "Fala livre"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-7 text-[rgba(255,239,192,0.92)]">
                        {entry.text}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(8,28,20,0.92)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
              <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[rgba(240,227,189,0.5)]">
                Maos gravadas nesta sessao
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[rgba(255,239,192,0.96)]">
                Cortes detectados
              </h2>

              <div className="mt-5 grid gap-4">
                {savedVideos.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-5 text-sm leading-7 text-[rgba(237,226,197,0.68)]">
                    Nenhuma mao foi salva ainda nesta base local.
                  </div>
                ) : (
                  savedVideos.slice(0, 6).map((video) => (
                    <article
                      key={video.id}
                      className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-base font-bold text-[rgba(255,239,192,0.96)]">{video.title}</p>
                        <span className="text-xs uppercase tracking-[0.18em] text-[rgba(240,227,189,0.48)]">
                          {formatDuration(video.durationSeconds)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[rgba(237,226,197,0.68)]">
                        {formatDateTime(video.startedAt)}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <ActionButton
                          label="Assistir"
                          onClick={() => void handleOpenSavedVideo(video.id)}
                          tone="accent"
                        />
                        <ActionButton
                          label="Ir para videos"
                          onClick={() => setActiveView("videos")}
                          tone="muted"
                        />
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeView === "admin" ? (
          <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-[2rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(8,28,20,0.92)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[rgba(240,227,189,0.5)]">
                    Transcricoes da sessao
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-[rgba(255,239,192,0.96)]">
                    Arquivos TXT
                  </h2>
                </div>

                <ActionButton label="Atualizar lista" onClick={() => void refreshSavedTranscripts()} tone="muted" />
              </div>

              <div className="mt-5 grid gap-4">
                {isLoadingSavedTranscripts ? (
                  <p className="text-sm text-[rgba(237,226,197,0.72)]">Carregando transcricoes...</p>
                ) : savedTranscripts.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-5 text-sm leading-7 text-[rgba(237,226,197,0.68)]">
                    Nenhuma transcricao de sessao foi salva ainda. Assim que voce iniciar e parar
                    uma sessao continua, o TXT vai aparecer aqui.
                  </div>
                ) : (
                  savedTranscripts.map((transcript) => (
                    <button
                      key={transcript.id}
                      className={`rounded-[1.2rem] border p-4 text-left transition ${
                        selectedTranscriptId === transcript.id
                          ? "border-[rgba(255,208,101,0.28)] bg-[rgba(255,183,32,0.1)]"
                          : "border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)]"
                      }`}
                      onClick={() => setSelectedTranscriptId(transcript.id)}
                      type="button"
                    >
                      <p className="text-base font-bold text-[rgba(255,239,192,0.96)]">
                        {transcript.title}
                      </p>
                      <p className="mt-2 text-sm text-[rgba(237,226,197,0.68)]">
                        {formatDateTime(transcript.startedAt)} ate {formatDateTime(transcript.endedAt)}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[rgba(240,227,189,0.48)]">
                        {transcript.lineCount} linhas
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(8,28,20,0.92)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
              <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[rgba(240,227,189,0.5)]">
                Visualizador TXT
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[rgba(255,239,192,0.96)]">
                Conteudo detectado
              </h2>

              <div className="mt-5 rounded-[1.5rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(2,10,7,0.95)] p-4">
                <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words text-sm leading-7 text-[rgba(237,226,197,0.76)]">
                  {savedTranscripts.find((item) => item.id === selectedTranscriptId)?.content ??
                    "Selecione um TXT salvo para visualizar a transcricao completa da sessao."}
                </pre>
              </div>
            </div>
          </section>
        ) : null}

        {!integratedMode ? (
          <section className="grid gap-4 rounded-[2rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(8,28,20,0.92)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.32)] lg:grid-cols-3">
            <LabPhaseCard
              description="Rodar tudo so com recursos nativos do navegador para validar camera do celular, preview ao vivo e buffer local sem salvar o video bruto."
              phase="Fase 1"
              title="Captura local"
            />
            <LabPhaseCard
              description="Adicionar transcricao local com whisper.cpp rodando fora do navegador, sem custo por uso, recebendo o audio da propria live."
              phase="Fase 2"
              title="Transcricao local"
            />
            <LabPhaseCard
              description="Usar OpenCV.js para detectar mudancas na regiao do board e, depois, evoluir para reconhecimento das cartas comunitarias."
              phase="Fase 3"
              title="Deteccao do board"
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.3rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-[rgba(240,227,189,0.48)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-[rgba(255,239,192,0.96)]">{value}</p>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  tone = "primary",
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  tone?: "primary" | "accent" | "muted";
  disabled?: boolean;
}) {
  const toneClassName =
    tone === "accent"
      ? "bg-[linear-gradient(180deg,#ffd766,#e0aa16)] text-[#142b1d] shadow-[0_14px_26px_rgba(224,170,22,0.24)]"
      : tone === "muted"
        ? "bg-[rgba(255,255,255,0.05)] text-[rgba(255,239,192,0.92)]"
        : "bg-[linear-gradient(180deg,#1c7d49,#0d5a31)] text-[rgba(241,255,247,0.96)] shadow-[0_14px_26px_rgba(13,90,49,0.24)]";

  return (
    <button
      className={`rounded-[1rem] px-4 py-3 text-sm font-black uppercase tracking-[0.14em] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 ${toneClassName}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function ToggleCard({
  label,
  description,
  isActive,
  onToggle,
}: {
  label: string;
  description: string;
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={`rounded-[1.2rem] border px-4 py-4 text-left transition ${
        isActive
          ? "border-[rgba(255,208,101,0.24)] bg-[rgba(255,183,32,0.1)]"
          : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]"
      }`}
      onClick={onToggle}
      type="button"
    >
      <p className="text-sm font-bold text-[rgba(255,239,192,0.96)]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[rgba(237,226,197,0.68)]">{description}</p>
      <p className="mt-3 text-[0.72rem] font-black uppercase tracking-[0.18em] text-[rgba(255,208,101,0.88)]">
        {isActive ? "Ligado" : "Desligado"}
      </p>
    </button>
  );
}

function SliderField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[rgba(255,239,192,0.92)]">{label}</span>
        <span className="text-xs font-black uppercase tracking-[0.16em] text-[rgba(255,208,101,0.8)]">
          {value}%
        </span>
      </div>
      <input
        className="accent-[#f3c44e]"
        max={100}
        min={0}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
    </label>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-[0.68rem] uppercase tracking-[0.2em] text-[rgba(240,227,189,0.46)]">
        {label}
      </span>
      <span className="break-all text-sm text-[rgba(255,239,192,0.92)]">{value}</span>
    </div>
  );
}

function LabPhaseCard({
  phase,
  title,
  description,
}: {
  phase: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[1.4rem] border border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)] p-4">
      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-[rgba(240,227,189,0.48)]">{phase}</p>
      <h3 className="mt-2 text-lg font-bold text-[rgba(255,239,192,0.96)]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[rgba(237,226,197,0.68)]">{description}</p>
    </article>
  );
}

function SubmenuCard({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-[1.5rem] border p-5 text-left transition ${
        active
          ? "border-[rgba(255,208,101,0.34)] bg-[rgba(255,183,32,0.12)] shadow-[0_18px_36px_rgba(0,0,0,0.22)]"
          : "border-[rgba(255,208,101,0.12)] bg-[rgba(255,255,255,0.03)]"
      }`}
      onClick={onClick}
      type="button"
    >
      <p className="text-lg font-bold text-[rgba(255,239,192,0.96)]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[rgba(237,226,197,0.68)]">{description}</p>
    </button>
  );
}

function getPreferredMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  const candidates = [
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=h264,opus",
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function detectTranscriptCommand(text: string): CommandKind {
  if (
    /(^|\s)(nova partida|iniciar partida|comecar partida|abrir partida|nova rodada|nova mao|iniciar mao|comecar mao|abrir mao)(\s|$)/i.test(text) ||
    hasCommandWord(text, ["nova", "iniciar", "comecar", "abrir"]) && hasHandWord(text)
  ) {
    return "start";
  }

  if (
    /(^|\s)(encerrar partida|fim da partida|partida encerrada|fechar partida|terminar partida|finalizar partida|encerrar mao|fim da mao|mao encerrada|fechar mao|terminar mao|finalizar mao)(\s|$)/i.test(text) ||
    hasCommandWord(text, ["encerrar", "fim", "fechar", "terminar", "finalizar"]) &&
      hasHandWord(text)
  ) {
    return "end";
  }

  if (
    /(^|\s)(salvar essa mao|salvar mao|salvar gravacao|salva essa mao|guardar essa mao|gravar essa mao)(\s|$)/i.test(text)
  ) {
    return "save";
  }

  return "none";
}

function looksLikeTableSpeech(cleanText: string, normalized: string) {
  if (!normalized) {
    return false;
  }

  if (detectTranscriptCommand(normalized) !== "none") {
    return true;
  }

  if (looksLikeSaveDecisionCommand(normalized)) {
    return true;
  }

  if (/\b(preflop|flop|turn|river|showdown|blind|blinds|small blind|big blind)\b/i.test(normalized)) {
    return true;
  }

  if (
    /\b(all[\s-]?in|allin|apostou|aposta|bet|raise|aumentou|subiu|call|pagou|check|mesa|passou|fold|largou|desistiu|salvar essa mao|salvar mao)\b/i.test(
      normalized,
    )
  ) {
    return true;
  }

  if (looksLikeAmountOnlySpeech(normalized)) {
    return true;
  }

  if (looksLikeNamedAmountSpeech(cleanText, normalized)) {
    return true;
  }

  return false;
}

function looksLikeAmountOnlySpeech(normalized: string) {
  return /^(?:r\$ ?)?\d+(?:[.,]\d+)?$/.test(normalized) || looksLikeAmountWordsOnly(normalized);
}

function looksLikeNamedAmountSpeech(cleanText: string, normalized: string) {
  const rawTokens = cleanText
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const normalizedTokens = normalized
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (rawTokens.length < 2 || rawTokens.length > 4) {
    return false;
  }

  const numericTokenCount = normalizedTokens.filter((token) =>
    /^(?:r\$)?\d+(?:[.,]\d+)?$/.test(token),
  ).length;
  const namedAmountValue = extractNamedAmountValue(normalized);

  if (numericTokenCount !== 1 && namedAmountValue === null) {
    return false;
  }

  const firstRawToken = rawTokens[0] ?? "";
  const hasNameLikePrefix = /^[A-ZÀ-Ý][a-zà-ÿ'-]+$/u.test(firstRawToken);

  if (!hasNameLikePrefix) {
    return false;
  }

  return !/\b(apostou|aposta|bet|raise|aumentou|subiu|call|pagou|check|mesa|passou|fold|largou|desistiu)\b/i.test(
    normalized,
  );
}

function looksLikeSaveDecisionCommand(normalized: string) {
  return /\b(salvar (essa )?(mao|gravacao)|gravar (essa )?mao)\b/i.test(normalized);
}

function looksLikeAmountWordsOnly(normalized: string) {
  const tokens = normalized.split(" ").filter(Boolean);

  if (tokens.length === 0) {
    return false;
  }

  return tokens.every((token) => token === "e" || isPortugueseNumberToken(token)) &&
    extractPortugueseAmountValue(normalized) !== null;
}

function extractNamedAmountValue(normalized: string) {
  const tokens = normalized.split(" ").filter(Boolean);

  if (tokens.length < 2) {
    return null;
  }

  return extractPortugueseAmountValue(tokens.slice(1).join(" "));
}

function extractPortugueseAmountValue(text: string) {
  const normalized = text.replace(/[^a-z0-9\s]/g, " ");
  const tokens = normalized.split(" ").filter(Boolean);
  let bestMatch: { value: number; length: number } | null = null;

  for (let start = 0; start < tokens.length; start += 1) {
    for (let end = start; end < Math.min(tokens.length, start + 6); end += 1) {
      const candidateValue = parsePortugueseNumberTokens(tokens.slice(start, end + 1));

      if (candidateValue === null || candidateValue < 5) {
        continue;
      }

      const candidateLength = end - start + 1;

      if (!bestMatch || candidateLength >= bestMatch.length) {
        bestMatch = {
          value: candidateValue,
          length: candidateLength,
        };
      }
    }
  }

  return bestMatch?.value ?? null;
}

function parsePortugueseNumberTokens(tokens: string[]) {
  if (tokens.length === 0) {
    return null;
  }

  let total = 0;
  let current = 0;
  let sawNumberWord = false;

  for (const token of tokens) {
    if (token === "e") {
      continue;
    }

    const numberValue = resolvePortugueseNumberToken(token);

    if (numberValue === null) {
      return null;
    }

    sawNumberWord = true;

    if (token === "mil") {
      total += (current || 1) * 1000;
      current = 0;
      continue;
    }

    current += numberValue;
  }

  if (!sawNumberWord) {
    return null;
  }

  return total + current;
}

function isPortugueseNumberToken(token: string) {
  return resolvePortugueseNumberToken(token) !== null;
}

function resolvePortugueseNumberToken(token: string) {
  const tokenMap: Record<string, number> = {
    zero: 0,
    um: 1,
    uma: 1,
    dois: 2,
    duas: 2,
    tres: 3,
    quatro: 4,
    cinco: 5,
    seis: 6,
    sete: 7,
    oito: 8,
    nove: 9,
    dez: 10,
    onze: 11,
    doze: 12,
    treze: 13,
    quatorze: 14,
    catorze: 14,
    quinze: 15,
    dezesseis: 16,
    dezessete: 17,
    dezoito: 18,
    dezenove: 19,
    vinte: 20,
    trinta: 30,
    quarenta: 40,
    cinquenta: 50,
    sessenta: 60,
    setenta: 70,
    oitenta: 80,
    noventa: 90,
    cem: 100,
    cento: 100,
    duzentos: 200,
    trezentos: 300,
    quatrocentos: 400,
    quinhentos: 500,
    seiscentos: 600,
    setecentos: 700,
    oitocentos: 800,
    novecentos: 900,
    mil: 1000,
  };

  return tokenMap[token] ?? null;
}

function normalizeCommandText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(mal|mau|mo|maoo)\b/g, "mao")
    .replace(/\b(nona|noba|novo)\b/g, "nova")
    .replace(/\b(encera|encerra|encerar|encerrao)\b/g, "encerrar")
    .replace(/\b(terminar|termina)\b/g, "terminar")
    .replace(/\b(finaliza|finalizar)\b/g, "finalizar")
    .replace(/\b(fecha|fechar)\b/g, "fechar")
    .replace(/\b(comeca|comeca|comecar)\b/g, "comecar")
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasCommandWord(text: string, words: string[]) {
  return words.some((word) => new RegExp(`(^|\\s)${word}(\\s|$)`, "i").test(text));
}

function hasHandWord(text: string) {
  return /(^|\s)(mao|rodada|partida|jogada)(\s|$)/i.test(text);
}

function wait(durationMs: number) {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

function formatTimeOnly(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatFileTimestamp(value: Date) {
  const year = value.getFullYear().toString();
  const month = (value.getMonth() + 1).toString().padStart(2, "0");
  const day = value.getDate().toString().padStart(2, "0");
  const hour = value.getHours().toString().padStart(2, "0");
  const minute = value.getMinutes().toString().padStart(2, "0");
  const second = value.getSeconds().toString().padStart(2, "0");

  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function resolveImageExtension(mimeType: string) {
  if (mimeType.includes("png")) {
    return "png";
  }

  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return "jpg";
  }

  if (mimeType.includes("webp")) {
    return "webp";
  }

  return "bin";
}

function sanitizeTrainingLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCardDatasetFileName(
  sample: SavedCardSampleSummary & { rankLabel: string; suitLabel: string },
  extension: string,
) {
  const stage = sanitizeTrainingLabel(formatBoardStage(sample.boardStage));
  const rank = sanitizeTrainingLabel(sample.rankLabel);
  const suit = sanitizeTrainingLabel(sample.suitLabel);

  return `${rank}-${suit}-${stage}-${sample.id}.${extension}`;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o blob da carta."));
    reader.readAsDataURL(blob);
  });
}

function formatDuration(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(durationSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function formatBytes(sizeBytes: number) {
  return `${(sizeBytes / (1024 * 1024)).toFixed(2).replace(".", ",")} MB`;
}

function formatBoardStage(stage: BoardDetectionResult["stage"]) {
  if (stage === "preflop") {
    return "Preflop";
  }

  if (stage === "flop") {
    return "Flop";
  }

  if (stage === "turn") {
    return "Turn";
  }

  if (stage === "river") {
    return "River";
  }

  return "Indefinido";
}

function formatBoardCardLabel(
  box: Pick<
    BoardDetectionResult["boxes"][number],
    "label" | "rankGuess" | "suitGuess"
  >,
) {
  if (box.label) {
    return box.label;
  }

  if (box.rankGuess && box.suitGuess) {
    return `${box.rankGuess} de ${box.suitGuess}`;
  }

  if (box.rankGuess) {
    return `Rank provavel: ${box.rankGuess}`;
  }

  if (box.suitGuess) {
    return `Naipe provavel: ${box.suitGuess}`;
  }

  return null;
}

async function captureWaveSample(stream: MediaStream, durationMs: number) {
  const AudioContextCtor = window.AudioContext || (window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  }).webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error("Seu navegador nao suporta AudioContext para capturar WAV local.");
  }

  const audioContext = new AudioContextCtor({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const silence = audioContext.createGain();
  const chunks: Float32Array[] = [];

  silence.gain.value = 0;

  processor.onaudioprocess = (event) => {
    const channelData = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(channelData));
  };

  source.connect(processor);
  processor.connect(silence);
  silence.connect(audioContext.destination);

  await new Promise((resolve) => window.setTimeout(resolve, durationMs));

  processor.disconnect();
  source.disconnect();
  silence.disconnect();
  await audioContext.close();

  const merged = mergeFloat32Chunks(chunks);
  return encodeWave(merged, 16000);
}

function mergeFloat32Chunks(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function encodeWave(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;

  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
