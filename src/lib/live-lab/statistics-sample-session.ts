import type { TranscriptSessionRecord } from "@/lib/live-lab/hand-simulation";

export const STATISTICS_SAMPLE_SESSION: TranscriptSessionRecord = {
  id: "sample-session-002",
  title: "Simulacao local - 2 partidas",
  createdAt: "2026-04-10T18:00:00.000Z",
  startedAt: "2026-04-10T18:00:00.000Z",
  endedAt: "2026-04-10T18:02:25.000Z",
  lineCount: 42,
  content: `[15:00:00] Sistema: Configuracao da mesa carregada
[15:00:02] Sistema: Lugar 1 Tuba
[15:00:03] Sistema: Lugar 3 Caio
[15:00:04] Sistema: Lugar 5 Alisson
[15:00:05] Sistema: Lugar 7 Thomas
[15:00:06] Sistema: Botao inicial no Tuba
[15:00:07] Sistema: Blind 25/50
[15:00:10] Sistema: Comando de voz detectado para iniciar partida
[15:00:12] Transcricao: call
[15:00:14] Transcricao: call
[15:00:16] Transcricao: call
[15:00:18] Transcricao: check
[15:00:22] Transcricao: 100
[15:00:24] Transcricao: 200
[15:00:27] Transcricao: call
[15:00:31] Transcricao: call
[15:00:34] Transcricao: call
[15:00:38] Transcricao: check
[15:00:43] Transcricao: check
[15:00:46] Transcricao: check
[15:00:51] Transcricao: check
[15:00:55] Transcricao: 400
[15:00:58] Transcricao: call
[15:01:01] Transcricao: fold
[15:01:04] Transcricao: 1000
[15:01:08] Transcricao: call
[15:01:11] Transcricao: fold
[15:01:15] Sistema: Comando de voz detectado para encerrar partida
[15:01:20] Sistema: Comando de voz detectado para iniciar partida
[15:01:23] Transcricao: call
[15:01:26] Transcricao: call
[15:01:29] Transcricao: call
[15:01:32] Transcricao: check
[15:01:36] Transcricao: check
[15:01:39] Transcricao: check
[15:01:42] Transcricao: check
[15:01:45] Transcricao: check
[15:01:49] Transcricao: 200
[15:01:52] Transcricao: fold
[15:01:55] Transcricao: 400
[15:01:59] Transcricao: call
[15:02:03] Transcricao: call
[15:02:07] Transcricao: 500
[15:02:11] Transcricao: 1500
[15:02:16] Transcricao: fold
[15:02:20] Transcricao: fold
[15:02:25] Sistema: Comando de voz detectado para encerrar partida`,
};
