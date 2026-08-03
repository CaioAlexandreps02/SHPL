# Auditoria de Persistencia — SHPL Poker App

> Data: 03/08/2026
> Status: 6 bugs corrigidos, 4 pendentes (este documento)

---

## Sumario

| # | Bug | Severidade | Status |
|---|-----|-----------|--------|
| 1 | Merge com seed do repo git restaurava etapas deletadas | Critico | CORRIGIDO |
| 2 | `readRemoteDocument` criava mock em arquivo ausente | Critico | CORRIGIDO |
| 3 | `readStore()` escrevia de volta dados normalizados (race condition) | Critico | CORRIGIDO |
| 4 | `readRemoteDocument` nao fazia fallback local quando Supabase falhava | Alto | CORRIGIDO |
| 5 | Stores de texto/binario criavam defaults no read | Alto | CORRIGIDO |
| 6 | `readLocalDocument` escrevia default em arquivo ausente | Alto | CORRIGIDO |
| 7 | Race condition em mutations do admin store | Critico | PENDENTE |
| 8 | Race condition em mutations do league state | Critico | PENDENTE |
| 9 | Race condition em `appendServerTextDocument` | Alto | PENDENTE |
| 10 | IDs com `Date.now()` causam colisoes | Medio | PENDENTE |
| 11 | `upsert: true` sem versionamento | Medio | PENDENTE |
| 12 | Sem `beforeunload` — dados perdidos ao fechar aba | Critico | PENDENTE |
| 13 | Sem retry no sync do runtime | Alto | PENDENTE |
| 14 | Sem indicador visual de sync | Medio | PENDENTE |
| 15 | `demo-league-store.ts` usa filesystem direto | Alto | PENDENTE |

---

## Bugs Corrigidos (1-6)

### Bug 1: Merge com seed do repo git restaurava etapas deletadas

**Arquivos:** `demo-league-state.ts`, `demo-admin-store.ts`

**O que acontecia:**
Toda vez que `readState()` ou `readStore()` eram chamados, faziam merge entre o estado remoto (Supabase/JSON) e um "seed" embutido no repo git (`data/demo-league-state.json`). A funcao `mergeByKey` adicionava de volta qualquer etapa que existisse no seed mas nao existisse no estado remoto — ou seja, etapas deletadas reapareciam.

**Exemplo:**
```
1. Admin deleta etapa "stage-07" do Supabase Storage
2. Proxima leitura: readState() busca JSON remoto (stage-07 nao existe)
3. readBundledLeagueStateSeed() le data/demo-league-state.json (stage-07 EXISTE no seed)
4. mergeLeagueStates() adiciona stage-07 de volta
5. Resultado merged e gravado no Supabase
6. Etapa reapareceu
```

**Solucao implementada:**
`readState()` agora retorna direto o resultado de `readServerJsonDocument()`, sem merge. Funcoes `mergeLeagueStates`, `mergeByKey`, `readBundledLeagueStateSeed` foram removidas.

---

### Bug 2: `readRemoteDocument` criava mock em arquivo ausente

**Arquivo:** `server-json-store.ts`

**O que acontecia:**
Quando o arquivo nao existia no Supabase Storage (erro 404 ou null), a funcao criava um default/mock e **escrevia de volta ao Supabase**. Isso sobrescrevia slots onde dados deveriam estar.

**Solucao implementada:**
`readRemoteDocument` e `readLocalDocument` agora retornam o default **sem gravar**. O arquivo so e criado no primeiro write explicito.

---

### Bug 3: `readStore()` escrevia de volta dados normalizados

**Arquivo:** `demo-admin-store.ts`

**O que acontecia:**
`readStore()` era uma funcao de leitura que **tambem escrevia** de volta quando detectava diferencas de normalizacao (ex: `isTest` convertido de string para boolean). Toda mutation (create/update/delete) chamava `readStore()` primeiro, entao havia duas escritas para a mesma operacao — a da normalizacao e a da mutation. Em concorrencia, a escrita da normalizacao podia sobrescrever a da mutation.

**Solucao implementada:**
`readStore()` agora so normaliza em memoria, sem escrever de volta. A normalizacao so e persistida quando uma mutation explicita acontece.

---

### Bug 4: `readRemoteDocument` nao fazia fallback local

**Arquivo:** `server-json-store.ts`

**O que acontecia:**
Quando `hasSupabaseServiceRoleEnv` era true mas o download do Supabase falhava (timeout, erro de rede), `readRemoteDocument` retornava `buildDefault()` — o mock inicial. Na proxima escrita, esse mock era salvo no Supabase, sobrescrevendo os dados reais.

**Solucao implementada:**
Quando o download remoto falha, a funcao agora faz fallback para `readLocalDocument()`, que pode ter dados validos em cache local.

---

### Bug 5: Stores de texto/binario criavam defaults no read

**Arquivos:** `server-text-store.ts`, `server-binary-store.ts`

**O que acontecia:**
Mesmo problema do Bug 2, mas nos stores de texto (logs de sessao) e binario (PDF do regulamento). Quando o arquivo remoto nao existia, criavam default e escreviam de volta ao Supabase.

**Solucao implementada:**
Ambos agora retornam default sem gravar, e fazem fallback para local quando remoto falha.

---

### Bug 6: `readLocalDocument` escrevia default em arquivo ausente

**Arquivo:** `server-json-store.ts`

**O que acontecia:**
Quando o arquivo local nao existia, criava com dados mock. Se o JSON local estivesse corrompido (escrita interrompida), o `JSON.parse` lancava erro, que era capturado silenciosamente, e o default era retornado — e escrito de volta, destruindo os dados corrompidos.

**Solucao implementada:**
`readLocalDocument` agora retorna default sem escrever. Se o JSON estiver corrompido, o erro de parse propagaria (mas ainda nao — veja Bug 9 para melhoria futura).

---

## Bugs Pendentes (7-15)

---

### Bug 7: Race condition em mutations do admin store

**Arquivo:** `demo-admin-store.ts`
**Severidade:** Critico

**O que acontece:**
Todas as mutacoes seguem o padrao read-modify-write sem protecao:

```
createStoredPlayer:
  1. store = await readStore()        // READ
  2. store.players.push(novoJogador)  // MODIFY
  3. await writeStore(store)          // WRITE (blind overwrite)

deleteStoredPlayer:
  1. store = await readStore()        // READ
  2. store.players = filter(...)      // MODIFY
  3. await writeStore(store)          // WRITE

saveStoredStage:
  1. store = await readStore()        // READ
  2. find or push stage               // MODIFY
  3. await writeStore(store)          // WRITE
```

**Cenario de perda:**
```
Request A: readStore() → [jogador1, jogador2]
Request B: readStore() → [jogador1, jogador2]  (mesmo snapshot)
Request A: push(jogador3) → writeStore([1,2,3])
Request B: push(jogador4) → writeStore([1,2,4])  // jogador3 PERDIDO
```

**Solucao proposta:**

Opcao A — **File lock** (simples, funciona para filesystem local):
```typescript
import lockfile from "proper-lockfile";

async function withStoreLock<T>(fn: () => Promise<T>): Promise<T> {
  const lockPath = path.join(process.cwd(), "data", ".locks");
  await mkdir(lockPath, { recursive: true });
  const lock = await lockfile.lock(lockPath, { retries: { retries: 5, factor: 1.5 } });
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}

// Uso:
async function createStoredPlayer(input: { name: string }) {
  return withStoreLock(async () => {
    const store = await readStore();
    // ... modify ...
    await writeStore(store);
    return player;
  });
}
```

Opcao B — **Optimistic locking com versao** (funciona para Supabase Storage):
```typescript
// Adicionar campo "version" ao store
type AdminStoreData = {
  version: number;
  players: StoredPlayerRecord[];
  stages: StoredStageRecord[];
};

// Na escrita, incrementar versao
async function writeStore(data: AdminStoreData) {
  const nextData = { ...data, version: data.version + 1 };
  await writeServerJsonDocument(adminStoreDocumentName, nextData);
}

// Na leitura, retornar versao
// Na mutacao, checar se versao nao mudou desde o read
async function createStoredPlayer(input: { name: string }) {
  const store = await readStore();
  const savedVersion = store.version;
  // ... modify ...
  const currentStore = await readStore();
  if (currentStore.version !== savedVersion) {
    // Retry ou erro
    throw new Error("Concorrencia detectada. Tente novamente.");
  }
  await writeStore({ ...modifiedStore, version: savedVersion + 1 });
}
```

**Recomendacao:** Opcao B (optimistic locking) — mais simples, nao requer dependencia extra, funciona tanto local quanto remoto.

---

### Bug 8: Race condition em mutations do league state

**Arquivo:** `demo-league-state.ts`
**Severidade:** Critico

**O que acontece:**
Mesmo padrao do Bug 7, mas nas funcoes de estado do campenato:

- `finalizeStage()` — read state, modifica, write (200+ linhas de logica)
- `updateAnnualPotOverride()` — read, modify, write
- `updateStageMatchPlacements()` — read, modify, write
- `updateAnnualRankingStats()` — read, modify, write

**Cenario de perda:**
```
Request A (finalizar etapa): readState() → state v1
Request B (ajustar posicoes): readState() → state v1
Request A: writeState(state com etapa finalizada)
Request B: writeState(state com posicoes ajustadas) // etapa finalizada PERDIDA
```

**Solucao proposta:**
Mesma abordagem do Bug 7 — optimistic locking com campo `version` no `DemoLeagueStateData`.

```typescript
type DemoLeagueStateData = {
  version: number;
  annualRankingStats: AnnualRankingStatsEntry[];
  annualStagePoints: AnnualStagePoints[];
  stageMatchPoints: StageMatchPoints[];
  history: StageHistoryEntry[];
  stageHistoryDetails: StageHistoryDetail[];
  annualPotCents: number;
  manualAnnualPotCents: number | null;
  manualAnnualPotNote: string | null;
  manualAnnualPotSetAt: string | null;
};
```

Adicionar `version` ao tipo, incrementar a cada write, checar antes de escrever.

---

### Bug 9: Race condition em `appendServerTextDocument`

**Arquivo:** `server-text-store.ts`
**Severidade:** Alto

**O que acontece:**
```typescript
export async function appendServerTextDocument(...) {
  const currentValue = await readServerTextDocument(...);  // READ
  const nextValue = `${currentValue}${fragment}`;          // CONCATENATE
  await writeServerTextDocument(documentName, nextValue);  // WRITE
}
```

Duas chamadas simultaneas (ex: dois dispositivos no live-lab) leem o mesmo texto, concatenam independentemente, e a segunda sobrescreve a primeira. Entries de log de sessao sao perdidas.

**Solucao proposta:**

Opcao A — **Append atomico** (usar `upsert` com merge no Supabase):
```typescript
export async function appendServerTextDocument(
  documentName: string,
  fragment: string,
  buildDefault: () => string | Promise<string> = () => "",
) {
  // Em vez de read-modify-write, usar append direto
  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    // Download atual, concatenar, upload com upsert
    const objectPath = buildRemoteObjectPath(documentName);
    const { data } = await supabase.storage.from(bucket).download(objectPath);
    const current = data ? new TextDecoder().decode(await data.arrayBuffer()) : await buildDefault();
    const next = `${current}${fragment}`;
    await supabase.storage.from(bucket).upload(objectPath, Buffer.from(next), { upsert: true });
    return next;
  }
  // Fallback local com lock
  return withFileLock(documentName, async () => {
    const current = await readLocalDocument(documentName, buildDefault);
    const next = `${current}${fragment}`;
    await writeLocalDocument(documentName, next);
    return next;
  });
}
```

Opcao B — **Usar Supabase Database** para logs (INSERT append-only):
```sql
CREATE TABLE stage_logs (
  id BIGSERIAL PRIMARY KEY,
  stage_id TEXT NOT NULL,
  entry TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
INSERTs sao atomicos por natureza — sem race condition.

**Recomendacao:** Opcao B e mais robusta, mas requer migration. Opcao A e mais rapida de implementar.

---

### Bug 10: IDs com `Date.now()` causam colisoes

**Arquivos:** `demo-admin-store.ts`, `shpl-stages-page.tsx`
**Severidade:** Medio

**O que acontece:**
```typescript
// demo-admin-store.ts
const player = { id: `player-${Date.now()}`, ... };

// shpl-stages-page.tsx
id: draft.id ?? `stage-${Date.now()}`,
```

Se dois players/etapas sao criados no mesmo milissegundo, ganham o mesmo ID. No `saveStoredStage`, que faz upsert por `id`, a segunda sobrescreve a primeira.

**Solucao proposta:**
Usar `crypto.randomUUID()` (disponivel em todos os browsers e Node.js 19+):

```typescript
// No servidor (Node.js)
import { randomUUID } from "node:crypto";
const player = { id: `player-${randomUUID()}`, ... };

// No cliente (browser)
const player = { id: `player-${crypto.randomUUID()}`, ... };
```

Ou usar `Date.now()` + `Math.random()` como fallback:
```typescript
const id = `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
```

---

### Bug 11: `upsert: true` sem versionamento

**Arquivo:** `server-json-store.ts` (e todos os stores)
**Severidade:** Medio

**O que acontece:**
Todas as escritas ao Supabase Storage usam `upsert: true`, que sobrescreve o objeto inteiro sem checar se alguem modificou desde a ultima leitura. O Supabase Storage nao tem built-in CAS (compare-and-swap).

**Solucao proposta:**
Combinar com o optimistic locking do Bug 7/8. O campo `version` no JSON permite detectar conflitos:

```typescript
async function writeServerJsonDocument<T extends { version?: number }>(
  documentName: string,
  data: T,
) {
  // A versao ja esta incrementada pelo chamador
  // Se houver concorrencia, o proximo read vai ver versao diferente
  await writeRemoteDocument(documentName, data);
}
```

Nao e perfeito (o Supabase Storage nao tem CAS), mas detecta conflitos na camada de aplicacao.

---

### Bug 12: Sem `beforeunload` — dados perdidos ao fechar aba

**Arquivo:** `stage-setup-screen.tsx`
**Severidade:** Critico

**O que acontece:**
O sync do runtime para o servidor e debounced (900ms quando rodando, 250ms quando pausado). Se o usuario fecha a aba, perde tab, ou o dispositivo descarrega, as ultimas mudancas no periodo do debounce sao perdidas — so existem no state do React, que e destruido.

**Fluxo atual:**
```
Mudanca de estado → localStorage.setItem (imediato)
                  → setTimeout(900ms) → fetch POST ao servidor
                  
Se fecha a aba antes do timeout:
  → Dados estao no localStorage mas NAO no servidor
  → Proxima vez que abrir, pode nao ter a mesma aba/sessao
```

**Solucao proposta:**
Adicionar handler `beforeunload` que faz um POST sincronico via `navigator.sendBeacon`:

```typescript
useEffect(() => {
  function handleBeforeUnload() {
    const runtimePayload = buildStageRuntimePayload(new Date().toISOString());
    const blob = new Blob([JSON.stringify({
      stage: { id: stage.id, title: stage.title, stageDate: stage.stageDate, scheduledStartTime: stage.scheduledStartTime },
      runtime: runtimePayload,
      session: { modules: { tableActive: true } },
    })], { type: "application/json" });
    
    navigator.sendBeacon("/api/shpl-admin/stage-session", blob);
  }

  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [buildStageRuntimePayload, stage]);
```

`sendBeacon` e garantido pelo browser enviar mesmo apos o fechamento da aba.

**Importante:** `sendBeacon` e limitado a ~64KB em alguns browsers. O payload do runtime geralmente e menor que isso, mas deve ser verificado.

---

### Bug 13: Sem retry no sync do runtime

**Arquivo:** `stage-setup-screen.tsx`
**Severidade:** Alto

**O que acontece:**
O sync do runtime (linhas 422-462) faz um `fetch POST` sem retry. Se falhar (erro de rede, timeout, 5xx), o estado e perdido no servidor. O proximo sync so acontece quando houver outra mudanca de estado — se o usuario nao fizer nada, os dados nao sao salvos.

**Solucao proposta:**
Adicionar retry com exponential backoff:

```typescript
async function syncRuntimeWithRetry(
  payload: StoredStageRuntimePayload,
  maxRetries = 3,
): Promise<boolean> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch("/api/shpl-admin/stage-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: { id: stage.id, title: stage.title, stageDate: stage.stageDate, scheduledStartTime: stage.scheduledStartTime },
          runtime: payload,
          session: { modules: { tableActive: true } },
        }),
      });
      if (response.ok) return true;
    } catch {
      // Aguardar antes de retry
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  return false;
}
```

E mostrar status de sync na UI (veja Bug 14).

---

### Bug 14: Sem indicador visual de sync

**Arquivo:** `stage-setup-screen.tsx`
**Severidade:** Medio

**O que acontece:**
O usuario nao tem como saber se os dados estao sendo salvos. Se o sync falhar silenciosamente, ele pode achar que esta tudo salvo quando nao esta.

**Solucao proposta:**
Adicionar estado de sync e um indicador visual:

```typescript
const [syncStatus, setSyncStatus] = useState<"saved" | "saving" | "error">("saved");

// No useEffect de sync:
setSyncStatus("saving");
const success = await syncRuntimeWithRetry(payload);
setSyncStatus(success ? "saved" : "error");

// Na UI (perto do titulo da etapa):
{syncStatus === "saving" && (
  <span className="text-xs text-[rgba(236,225,196,0.5)]">Salvando...</span>
)}
{syncStatus === "error" && (
  <span className="text-xs text-[rgba(255,132,92,0.8)]">Erro ao salvar</span>
)}
{syncStatus === "saved" && (
  <span className="text-xs text-[rgba(129,211,120,0.6)]">Salvo</span>
)}
```

---

### Bug 15: `demo-league-store.ts` usa filesystem direto

**Arquivo:** `demo-league-store.ts`
**Severidade:** Alto (bomba-relogio)

**O que acontece:**
Este arquivo antigo bypassa completamente o `server-json-store.ts` e le/gravenda direto no filesystem local:

```typescript
import { mkdir, readFile, writeFile } from "node:fs/promises";

const leagueStoreFile = path.join(dataDirectory, "demo-league-store.json");

async function readStore() {
  const raw = await readFile(leagueStoreFile, "utf8");  // filesystem direto
  return JSON.parse(raw);
}

async function writeStore(data) {
  await writeFile(leagueStoreFile, JSON.stringify(data, null, 2));  // filesystem direto
}
```

Se alguem importar este arquivo acidentalmente, os dados vao para o filesystem local (ou efemero no Vercel) em vez do Supabase Storage.

**Solucao proposta:**
Deletar o arquivo `demo-league-store.ts` completamente. Verificar se nenhum import referencia ele:

```bash
grep -r "demo-league-store" src/
```

Se nao houver imports, deletar com seguranca.

---

## Plano de Implementacao

### Fase 1 — Imediato (1-2 horas)
1. **Bug 12:** Adicionar `beforeunload` handler com `sendBeacon`
2. **Bug 10:** Trocar `Date.now()` por `crypto.randomUUID()`
3. **Bug 15:** Deletar `demo-league-store.ts` (verificar imports antes)

### Fase 2 — Curto prazo (2-4 horas)
4. **Bug 7 + 8:** Implementar optimistic locking com `version` no admin store e league state
5. **Bug 13:** Adicionar retry com backoff no sync do runtime
6. **Bug 14:** Adicionar indicador visual de sync

### Fase 3 — Medio prazo (4-8 horas)
7. **Bug 9:** Resolver race condition do `appendServerTextDocument` (lock ou migration para DB)
8. **Bug 11:** Combinar versionamento com as escritas ao Supabase Storage

---

## Configuracao Supabase (Obrigatorio)

Para que os dados persistam em producao, o SHPL precisa:

1. **Criar bucket `live-hand-clips`** no Supabase Storage:
   - ir em Storage > Buckets > New bucket
   - Nome: `live-hand-clips`
   - Public: false

2. **Configurar env vars no Vercel:**
   ```
   SUPABASE_URL=https://lsuhkzvbzgkbjyfuppeg.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sua-chave-aqui
   SUPABASE_ANON_KEY=sua-chave-anon-aqui
   ```

3. **Verificar se esta funcionando:**
   - Criar uma etapa
   - Jogar uma partida
   - Fechar o browser
   - Reabrir — os dados devem estar la

---

## Referencia

- Arquivos de storage: `src/lib/data/server-json-store.ts`, `server-text-store.ts`, `server-binary-store.ts`
- Admin store: `src/lib/data/demo-admin-store.ts`
- League state: `src/lib/data/demo-league-state.ts`
- Runtime sync: `src/components/stage-setup-screen.tsx` (useEffect de sync)
- Stage session API: `src/app/api/shpl-admin/stage-session/route.ts`
- Finalize stage API: `src/app/api/shpl-admin/finalize-stage/route.ts`
