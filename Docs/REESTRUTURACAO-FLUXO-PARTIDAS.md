# Reestruturação do Fluxo de Partidas — SHPL Poker

> Data: 03/08/2026 · Última atualização: 04/08/2026
> Status: Em implementação (Funcionalidades 6 e 7 parcialmente concluídas — ver status por item)
> Autor: Caio + Claude

---

## Sumário

| # | Funcionalidade | Prioridade | Estimativa | Status |
|---|---------------|-----------|-----------|--------|
| 1 | Modal "Definir resultado da partida" | Crítica | Alta | Planejado |
| 2 | BUG Fix: Último jogador = 1º lugar | Crítica | Baixa | ✅ Concluído |
| 3 | Modal "Jogador atrasado" | Alta | Média | ✅ Concluído |
| 4 | Auto-close sempre mostra modal | Média | Baixa | ✅ Concluído |
| 5 | Remover seção "Correção manual" | Média | Baixa | ✅ Concluído |
| 6 | Dependência: @dnd-kit/core | — | Pré-requisito | ✅ Concluído |
| 7 | Número de lugares configurável por mesa (8/10/12) | Média | Média | ⚠️ Parcial (dado, lógica e coordenadas visuais prontos) — ver 7.4 |
| 8 | Indicador de salvamento contínuo durante a partida | Média | Baixa | ✅ Concluído |
| 9 | Mesas múltiplas (até 2 mesas por etapa) | Média | Alta | ✅ Concluído |
| 10 | Modal "Confirmar resultado da etapa" | Alta | Média | ✅ Concluído |

---

## Funcionalidade 1: Modal "Definir resultado da partida"

### 1.1 Problema atual

O fluxo atual de encerrar uma partida tem vários problemas:

1. **Só é possível fechar quando sobra 0 ou 1 jogador** — o botão "Fechar partida" só aparece quando `activeMatchPlayers.length <= 1`. Se o dealer quer fechar com 4 jogadores ainda ativos (ex: acordo, horário, etc.), não tem como.

2. **Último jogador não recebe pontos** — quando `closeCurrentMatchAsFinished()` é chamado, ele só marca a partida como fechada. Não atribui `calculateMatchPoints(1)` pro vencedor.

3. **Seção "Correção manual" é confusa** — existe uma seção separada na tela principal pra editar posições de partidas passadas. Fica longe do contexto, é difícil de achar, e o dealer precisa saber que existe.

4. **Não tem como conferir o resultado antes de ir pra próxima partida** — quando a partida fecha, os pontos são aplicados silenciosamente. Se o dealer errou, precisa usar a seção manual pra corrigir.

### 1.2 Solução

Criar um modal **"Definir resultado da partida"** que aparece toda vez que uma partida é encerrada. O modal:

- Lista todos os jogadores que deram buy-in
- Permite reordenar via drag-and-drop
- Calcula pontos automaticamente baseado na posição
- Mostra jogadores que não participaram com 0 pts
- Dealer confirma antes de fechar

### 1.3 Especificação do componente

#### Nome do componente
`MatchResultModal`

#### Props
```typescript
type MatchResultModalProps = {
  isOpen: boolean;
  matchNumber: number;
  matchDurationSeconds: number;
  currentBlindLabel: string;
  players: MatchResultPlayer[];
  onConfirm: (result: MatchResultPayload) => void;
  onCancel: () => void;
};

type MatchResultPlayer = {
  playerId: string;
  playerName: string;
  photoDataUrl?: string;
  currentPoints: number;    // pontos atuais na partida
  outOfCurrentMatch: boolean; // se saiu da partida
  hasParticipated: boolean;  // se participou (saiu ou ainda tá)
  estimatedStack: number;
};

type MatchResultPayload = {
  placements: Array<{
    playerId: string;
    placement: number; // 1, 2, 3, etc.
  }>;
};
```

#### Layout do modal

```
┌──────────────────────────────────────────────────────┐
│  Partida 2 — Resultado                               │
│  Tempo: 45:32  |  Blind: 200/400                     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ ⠿ Caio          1º  (10 pts)    [arrastar]  │   │
│  │ ⠿ João          2º  (8 pts)     [arrastar]  │   │
│  │ ⠿ Pedro         3º  (6 pts)     [arrastar]  │   │
│  │ ⠿ Lucas         4º  (4 pts)     [arrastar]  │   │
│  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │   │
│  │ ⠿ Marcos        —   (0 pts)     [arrastar]  │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Legenda: 1º=10pts | 2º=8pts | 3º=6pts | 4º=4pts   │
│           5º+=2pts | Não participou=0pts             │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [Cancelar]              [Confirmar resultado]       │
└──────────────────────────────────────────────────────┘
```

#### Comportamento do drag-and-drop

1. **Lista ordenável** — o dealer arrasta pra cima/baixo pra reordenar
2. **Posições são recalculadas** baseado no índice: `posição = índice + 1`
3. **Pontos são recalculados** baseado na posição:
   - 1º = 10 pts
   - 2º = 8 pts
   - 3º = 6 pts
   - 4º = 4 pts
   - 5º+ = 2 pts
4. **Jogadores com 0 pts** (não participaram) aparecem no fundo da lista
5. **O dealer pode mover** um jogador de 0 pts pra qualquer posição
6. **Valores são atualizados em tempo real** durante o drag

#### Regras de negócio

- Só aparecem jogadores com buy-in confirmado (annualPaid + dailyPaid = true)
- Jogadores que saíram da partida mantêm sua posição baseada na ordem de saída
- Jogadores que nunca entraram começam no fundo com 0 pts
- O botão "Confirmar resultado" só habilita se houver pelo menos 1 jogador
- Validação: não pode ter dois jogadores na mesma posição (impossível com drag de lista)

### 1.4 Fases de implementação

#### Fase 1.4.1: Instalar dependência

```bash
cmd /c "cd C:\Caio\SHPL && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities"
```

**Arquivos afetados:** `package.json`, `package-lock.json`

#### Fase 1.4.2: Criar componente `MatchResultModal`

**Arquivo novo:** `src/components/match-result-modal.tsx`

**Conteúdo:**
- Componente client (`"use client"`)
- Estado local: `orderedPlayers` (array ordenável)
- Hook `useSortable` do `@dnd-kit/sortable` pra cada item
- Hook `DndContext` do `@dnd-kit/core` pra gerenciar o drag
- Cálculo de pontos: `calculateMatchPoints(position)`
- Layout baseado no design system existente (cores, border-radius, etc.)

**Estrutura interna:**
```
MatchResultModal
├── Header (título, tempo, blind)
├── SortableContext
│   ├── SortableItem (cada jogador)
│   │   ├── Drag handle (⠿)
│   │   ├── Nome
│   │   ├── Posição (1º, 2º, etc.)
│   │   └── Pontos (10 pts, 8 pts, etc.)
│   └── Divider (entre participantes e não-participantes)
├── Legenda
└── Footer (Cancelar / Confirmar)
```

#### Fase 1.4.3: Integrar modal no fluxo de fechamento

**Arquivo modificado:** `src/components/stage-setup-screen.tsx`

**Alterações:**
1. Adicionar state: `showMatchResultModal`
2. Adicionar state: `matchResultModalMode` ("close" | "auto-close" | "review")
3. Toda vez que `closeCurrentMatchAsFinished` é chamado → abrir modal ao invés de fechar direto
4. No modal, quando confirma → aplicar pontos e fechar partida
5. No auto-close (todos saíram) → abrir modal com positions baseadas na ordem de saída

**Funções a modificar:**
- `handleCloseCurrentMatch()` → abre modal
- `closeCurrentMatchAsFinished()` → chamado DEPOIS da confirmação do modal
- `useEffect` de auto-close → abre modal ao invés de fechar

#### Fase 1.4.4: Preparar dados pro modal

**Função nova:** `buildMatchResultPlayers()`

```typescript
function buildMatchResultPlayers(
  players: StagePlayerControl[],
  matchIndex: number
): MatchResultPlayer[] {
  return players
    .filter(p => p.annualPaid && p.dailyPaid) // só buy-in
    .map(p => ({
      playerId: p.playerId,
      playerName: p.playerName,
      currentPoints: p.matchPoints[matchIndex] ?? 0,
      outOfCurrentMatch: p.outOfCurrentMatch,
      hasParticipated: !p.outOfCurrentMatch || p.matchPoints[matchIndex] !== undefined,
      estimatedStack: p.estimatedStack,
    }))
    .sort((a, b) => b.currentPoints - a.currentPoints); // ordenar por pontos atuais
}
```

#### Fase 1.4.5: Aplicar resultado do modal

**Função nova:** `applyMatchResult()`

```typescript
function applyMatchResult(payload: MatchResultPayload) {
  setPlayers(current => current.map(player => {
    const placement = payload.placements.find(p => p.playerId === player.playerId);
    const nextMatchPoints = [...player.matchPoints];
    
    if (placement) {
      nextMatchPoints[currentMatchIndex] = calculateMatchPoints(placement.placement);
    } else {
      nextMatchPoints[currentMatchIndex] = 0;
    }
    
    return { ...player, matchPoints: nextMatchPoints };
  }));
  
  closeCurrentMatchAsFinished("Partida encerrada com resultado confirmado.");
}
```

#### Fase 1.4.6: Testar e ajustar

- Testar drag-and-drop em diferentes cenários
- Testar com 2, 3, 4, 5+ jogadores
- Testar com jogadores que saíram
- Testar com jogadores que nunca entraram
- Verificar se pontos são calculados corretamente
- Verificar responsividade mobile

---

## Funcionalidade 2: BUG Fix — Último jogador = 1º lugar

> **✅ Concluído em 04/08/2026.** O fechamento da partida agora passa pelo `MatchResultModal`. Durante a validação, foi corrigida a ordenação inicial do modal para colocar jogadores ainda ativos acima dos eliminados; assim, quando resta um único jogador ativo, ele aparece como 1º lugar antes da confirmação e recebe 10 pts ao confirmar o resultado.

### 2.1 Problema atual

Quando a partida tem apenas 1 jogador restante (os outros saíram), existem **dois botões** que podem fechar a partida, com comportamentos diferentes:

1. **`ENCERRAR PARTIDA`** (botão do timer) → chama `handleCloseCurrentMatch()` → chama `closeCurrentMatchAsFinished()` direto. **Não atribui pontos** pro vencedor. Esse é o bug.
2. **`Fechar partida`** (botão que abre modal de confirmação) → chama `handleManualCloseMatch()`, que **já atribui `calculateMatchPoints(1)`** corretamente antes de fechar a partida.

Ou seja, o bug só acontece se o dealer usar o botão `ENCERRAR PARTIDA` do timer. O outro caminho já funciona certo hoje. Isso significa que a correção abaixo (mexer em `closeCurrentMatchAsFinished`) resolve o bug nos dois botões — mas os dois botões continuarão existindo, fazendo a mesma coisa por caminhos diferentes. Vale considerar unificar os dois no fluxo do novo `MatchResultModal` (Funcionalidade 1) pra não manter essa duplicidade.

**Código atual (problemático):**
```typescript
function closeCurrentMatchAsFinished(notice: string) {
  if (currentMatchClosed) return;
  setIsRunning(false);
  setActionClockRemaining(null);
  setCurrentMatchClosed(true);
  setCompletedMatchDurations(currentDurations => {
    if (currentDurations.length > currentMatchIndex) return currentDurations;
    return [...currentDurations, matchElapsedSeconds];
  });
  setStageNotice(notice);
  // ← AQUI: não atribui pontos pro vencedor
}
```

**Consequência:** O último jogador que ficou sozinho não recebe os 10 pontos de vitória.

### 2.2 Solução

Antes de fechar a partida, verificar se sobrou exatamente 1 jogador ativo. Se sim, atribuir `calculateMatchPoints(1)` = 10 pontos.

### 2.3 Fases de implementação

#### Fase 2.3.1: Corrigir `closeCurrentMatchAsFinished`

**Arquivo:** `src/components/stage-setup-screen.tsx`

**Alteração:**
```typescript
const closeCurrentMatchAsFinished = useCallback(
  (notice: string) => {
    if (currentMatchClosed) return;
    
    // NOVO: Se sobrou 1 jogador ativo, atribui 1º lugar
    if (activeMatchPlayers.length === 1) {
      const winnerId = activeMatchPlayers[0].playerId;
      setPlayers(currentPlayers =>
        currentPlayers.map(player => {
          if (player.playerId !== winnerId) return player;
          const nextMatchPoints = [...player.matchPoints];
          nextMatchPoints[currentMatchIndex] = calculateMatchPoints(1);
          return { ...player, matchPoints: nextMatchPoints };
        })
      );
    }
    
    setIsRunning(false);
    setActionClockRemaining(null);
    setCurrentMatchClosed(true);
    setCompletedMatchDurations(currentDurations => {
      if (currentDurations.length > currentMatchIndex) return currentDurations;
      return [...currentDurations, matchElapsedSeconds];
    });
    setStageNotice(notice);
  },
  [currentMatchClosed, currentMatchIndex, matchElapsedSeconds, activeMatchPlayers]
);
```

#### Fase 2.3.2: Atualizar dependencies do useCallback

O `activeMatchPlayers` precisa entrar nas dependencies do `useCallback` pra garantir que o valor está atualizado.

#### Fase 2.3.3: Testar cenários

- Testar com 2 jogadores, 1 sai → último fica com 10 pts
- Testar com 3 jogadores, 2 saem → último fica com 10 pts
- Testar auto-close (todos saem) → modal mostra resultado
- Testar acuerdo/desistência → último fica com 10 pts

---

## Funcionalidade 3: Modal "Jogador atrasado"

> **✅ Concluído em 04/08/2026.** Criado `LatePlayerModal` e integrado ao fluxo de buy-in durante partida em andamento. Quando o jogador confirma buy-in com a partida já aberta, ele fica fora da partida atual até o dealer escolher no modal: entrar agora com stack ajustável e assento em Mesa/Lugar, ou ficar para a próxima com 0 ponto na partida atual.

### 3.1 Problema atual

Quando um jogador chega depois da partida iniciada, o fluxo atual é:

1. Dealer seleciona o jogador
2. Clica "Buy-in dos dois" (ou "Buy-in anual" + "Buy-in do dia")
3. Clica "Entrar na partida"
4. Stack é calculado automaticamente (média dos ativos)
5. Jogador entra

**Problemas:**
- São **3 ações separadas** (confuso)
- **Não pergunta** se o jogador vai entrar agora ou só na próxima
- **Stack não pode ser ajustado** antes de confirmar
- Se o dealer esquece de clicar "Entrar na partida", o jogador fica "comprado mas fora"

### 3.2 Solução

Detectar quando um jogador confirma buy-in durante uma partida em andamento e **abrir um modal** perguntando:

1. **"Entrar agora"** → mostra stack + seleção de lugar
2. **"Só na próxima"** → jogador fica fora, 0 pts nessa partida

### 3.3 Especificação do componente

#### Nome do componente
`LatePlayerModal`

#### Props
```typescript
type LatePlayerModalProps = {
  isOpen: boolean;
  playerName: string;
  matchNumber: number;
  averageStack: number;
  availableSeats: Array<{ index: number; label: string }>;
  onJoinNow: (stack: number, seatIndex: number) => void;
  onJoinNextMatch: () => void;
  onCancel: () => void;
};
```

#### Layout do modal

```
┌──────────────────────────────────────────────────────┐
│  João vai entrar na partida?                         │
│  Partida 2 já começou                                │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  🟢 Entrar agora                             │   │
│  │                                               │   │
│  │  Stack: [3000]  (média dos ativos: 3000)     │   │
│  │  Lugar: [Lugar 3 ▾]                          │   │
│  │                                               │   │
│  │  [Confirmar entrada]                          │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  🟡 Só na próxima                            │   │
│  │                                               │   │
│  │  João fica fora dessa partida.                │   │
│  │  Na próxima partida ele entra normalmente.    │   │
│  │                                               │   │
│  │  [Confirmar]                                  │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [Cancelar]                                          │
└──────────────────────────────────────────────────────┘
```

### 3.4 Fases de implementação

#### Fase 3.4.1: Criar componente `LatePlayerModal`

**Arquivo novo:** `src/components/late-player-modal.tsx`

**Conteúdo:**
- Componente client
- Estado local: `selectedStack`, `selectedSeat`
- Dois modos: "join-now" e "join-next"
- Campo de stack com validação (mínimo 0)
- Dropdown de lugares vagos

#### Fase 3.4.2: Detectar buy-in durante partida

**Arquivo:** `src/components/stage-setup-screen.tsx`

**Alteração nas funções de buy-in:**
- `handleConfirmBothBuyIns()`
- `handleConfirmDailyBuyIn()`
- `handleConfirmAnnualBuyIn()`

**Lógica:**
```typescript
function handleConfirmBothBuyIns() {
  const playerName = selectedPlayer?.playerName;
  pushPlayerActionSnapshot();
  updateSelectedPlayer(player) => ({
    ...player,
    annualPaid: true,
    dailyPaid: true,
    outOfCurrentMatch:
      currentMatchStartedAt && !currentMatchClosed
        ? false  // ← era false, mas agora precisa de modal
        : player.outOfCurrentMatch,
  }));

  // NOVO: Se partida começou e não foi fechada, abrir modal
  if (currentMatchStartedAt && !currentMatchClosed) {
    setShowLatePlayerModal(true);
    return; // não confirma ainda, modal decide
  }

  // ... resto do fluxo normal
}
```

**Problema:** A função `updateSelectedPlayer` aplica a mudança imediatamente. Precisa ser reestruturada pra:
1. Confirmar buy-in (annual + daily)
2. **Depois** abrir modal se partida em andamento
3. Modal decide se entra agora ou na próxima

#### Fase 3.4.3: Integrar modal no fluxo

**Arquivo:** `src/components/stage-setup-screen.tsx`

**States novos:**
```typescript
const [showLatePlayerModal, setShowLatePlayerModal] = useState(false);
const [latePlayerContext, setLatePlayerContext] = useState<{
  playerId: string;
  playerName: string;
} | null>(null);
```

**Handler "Entrar agora":**
```typescript
function handleLatePlayerJoinNow(stack: number, seatIndex: number) {
  if (!latePlayerContext) return;
  
  updateSelectedPlayer(p => ({
    ...p,
    outOfCurrentMatch: false,
    estimatedStack: stack,
  }));
  
  // Assign seat
  handleDirectSeatAssignmentChange(seatIndex, latePlayerContext.playerId);
  
  setShowLatePlayerModal(false);
  setLatePlayerContext(null);
}
```

**Handler "Só na próxima":**
```typescript
function handleLatePlayerJoinNextMatch() {
  if (!latePlayerContext) return;
  
  updateSelectedPlayer(p => ({
    ...p,
    outOfCurrentMatch: true,
  }));
  
  // 0 pts nessa partida
  setPlayers(current => current.map(player => {
    if (player.playerId !== latePlayerContext.playerId) return player;
    const nextMatchPoints = [...player.matchPoints];
    nextMatchPoints[currentMatchIndex] = 0;
    return { ...player, matchPoints: nextMatchPoints };
  }));
  
  setShowLatePlayerModal(false);
  setLatePlayerContext(null);
}
```

#### Fase 3.4.4: Calcular lugares vagos

**Função nova:** `getAvailableSeats()`

```typescript
function getAvailableSeats() {
  return Array.from({ length: TOTAL_TABLE_SEATS }, (_, seatIndex) => ({
    index: seatIndex,
    label: `Lugar ${seatIndex + 1}`,
  })).filter((seat) => seatAssignments[seat.index] === null);
}
```

- Usar a constante `TOTAL_TABLE_SEATS` já importada em `stage-setup-screen.tsx` (= `LIVE_LAB_TOTAL_TABLE_SEATS` = **8**, não 10).
- Um lugar está livre quando `seatAssignments[index] === null`. Não faz sentido comparar índice de lugar com um `Set` de `playerId`s (são tipos diferentes) — a versão anterior desse trecho nunca filtrava nenhum lugar ocupado.

#### Fase 3.4.5: Testar cenários

- Jogador chega, partida rolando → modal aparece
- Escolhe "Entrar agora" → entra com stack ajustado
- Escolhe "Só na próxima" → fica fora, 0 pts
- Cancela → nada muda
- Jogador chega, partida NÃO começou → sem modal, fluxo normal
- Jogador chega, partida já fechada → sem modal, entra na próxima

---

## Funcionalidade 4: Auto-close sempre mostra modal

### 4.1 Problema atual

Quando todos os jogadores saem da partida, o `useEffect` de auto-close fecha a partida silenciosamente:

```typescript
useEffect(() => {
  if (stageClosedAt || currentMatchClosed || currentMatchStartedAt === null ||
      activeMatchPlayers.length > 0) {
    return;
  }
  closeCurrentMatchAsFinished("Todos os jogadores sairam...");
}, [...]);
```

**Problema:** O dealer não tem como conferir ou ajustar o resultado antes de ir pra próxima partida.

### 4.2 Solução

Ao invés de chamar `closeCurrentMatchAsFinished` direto, abrir o modal de resultado.

### 4.3 Fases de implementação

#### Fase 4.3.1: Modificar useEffect de auto-close

**Arquivo:** `src/components/stage-setup-screen.tsx`

**Alteração:**
```typescript
useEffect(() => {
  if (stageClosedAt || currentMatchClosed || currentMatchStartedAt === null ||
      activeMatchPlayers.length > 0) {
    return;
  }
  
  // ANTES: closeCurrentMatchAsFinished("Todos saíram...");
  // AGORA: abrir modal de resultado
  setShowMatchResultModal(true);
  setMatchResultModalMode("auto-close");
}, [
  stageClosedAt,
  currentMatchClosed,
  currentMatchStartedAt,
  activeMatchPlayers.length,
]);
```

#### Fase 4.3.2: Preparar dados pro modal no auto-close

Quando o modal abre em modo "auto-close", os dados vêm da ordem de saída dos jogadores:

```typescript
function buildAutoCloseResultPlayers(): MatchResultPlayer[] {
  // Jogadores que saíram, ordenados por ordem de saída
  // Quem saiu primeiro = último lugar
  return players
    .filter(p => p.annualPaid && p.dailyPaid)
    .sort((a, b) => {
      // Jogadores que ainda tão na partida ficam no topo
      if (!a.outOfCurrentMatch && b.outOfCurrentMatch) return -1;
      if (a.outOfCurrentMatch && !b.outOfCurrentMatch) return 1;
      // Empate: mantém ordem atual
      return 0;
    });
}
```

#### Fase 4.3.3: Testar

- Todos os jogadores saem → modal abre com resultado
- Dealer reordena e confirma → pontos aplicados
- Dealer cancela → volta pra tela (partida continua aberta)

---

## Funcionalidade 5: Remover seção "Correção manual"

> **✅ Concluído em 04/08/2026.** A seção visual "Correção manual" foi removida de `stage-setup-screen.tsx`, junto com states, handlers e helpers relacionados (`manualAdjustmentMatchIndex`, `manualPlacementDraft`, `handleApplyManualMatchAdjustment`, `buildManualPlacementDraft`, etc.). O ajuste de resultados agora passa pelos modais de partida e de etapa.

### 5.1 Problema atual

Existe uma seção "Correção manual" na tela principal que permite editar posições de partidas passadas. Essa seção:

- Fica longe do contexto (embaixo de tudo)
- É confusa (seletor de partida + inputs pra cada jogador)
- Duplica funcionalidade que agora está no modal

### 5.2 Solução

Remover toda a seção. A funcionalidade agora vive no modal "Definir resultado da partida".

### 5.3 Fases de implementação

#### Fase 5.3.1: Remover JSX da seção

**Arquivo:** `src/components/stage-setup-screen.tsx`

**Remover:** Toda a seção "Correção manual" (aproximadamente linhas 2221-2310)

**Elementos a remover:**
```tsx
<div className="mt-4 rounded-[1.1rem] border ...">
  <p>Correcao manual</p>
  <h4>Ajustar colocacoes da partida</h4>
  {/* ... todo o conteúdo da seção ... */}
</div>
```

#### Fase 5.3.2: Remover states relacionados

```typescript
// REMOVER:
const [manualAdjustmentMatchIndex, setManualAdjustmentMatchIndex] = useState(0);
const [manualPlacementDraft, setManualPlacementDraft] = useState<Record<string, string>>({});
```

#### Fase 5.3.3: Remover funções relacionadas

```typescript
// REMOVER:
function handleApplyManualMatchAdjustment() { ... }
function handleManualPlacementChange(playerId: string, nextValue: string) { ... }
function buildManualPlacementDraft(players: StagePlayerControl[], matchIndex: number) { ... }
```

#### Fase 5.3.4: Remover useEffect relacionado

```typescript
// REMOVER:
useEffect(() => {
  setManualAdjustmentMatchIndex((currentValue) => Math.min(currentValue, currentMatchIndex));
}, [currentMatchIndex]);

useEffect(() => {
  setManualPlacementDraft(buildManualPlacementDraft(players, manualAdjustmentMatchIndex));
}, [manualAdjustmentMatchIndex, players]);
```

#### Fase 5.3.5: Verificar se algo mais depende

Grep por `manualAdjustment` e `manualPlacement` pra garantir que nada mais referencia esses states/funções.

---

## Funcionalidade 5b: Modal "Confirmar resultado da etapa"

> **✅ Concluído em 04/08/2026.** Criado `StageResultModal`, aberto antes da confirmação administrativa de encerramento. O ranking final da etapa é arrastável e a ordem confirmada é enviada como `finalRankingPlayerIds` para `/api/shpl-admin/finalize-stage`. A finalização agora respeita essa ordem no ranking final, pontuação anual e histórico, sem alterar os pontos por partida.

### 5b.1 Contexto

Depois de resolver o resultado de cada partida com o `MatchResultModal`, também faz sentido confirmar a **ordem final da etapa** antes de encerrá-la definitivamente. Esse fluxo não estava no plano original; foi adicionado em 04/08/2026 antes da integração do modal de fechamento de partida.

### 5b.2 Solução

Criar um modal no mesmo estilo do `MatchResultModal`, aberto durante o fechamento da etapa, com o ranking final arrastável. O dealer/admin confere a ordem dos participantes, pode corrigir por drag-and-drop caso algo esteja errado, e só então confirma o encerramento.

### 5b.3 Observação de implementação

Implementar depois da integração do `MatchResultModal` no fechamento de partida. A ideia é reaproveitar a base visual e de drag-and-drop já criada, mas manter o fluxo separado porque fechamento de partida altera `matchPoints[currentMatchIndex]`, enquanto fechamento de etapa confirma o ranking agregado/final.

---

## Funcionalidade 6: Dependência @dnd-kit/core

> **✅ Concluído em 04/08/2026.** Pacotes instalados: `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`, `@dnd-kit/utilities@^3.2.2`. Sem uso ainda — só instalação, pronta pro `MatchResultModal` (Funcionalidade 1) consumir.

### 6.1 Por que precisamos

O drag-and-drop nativo do HTML5 é complexo de implementar e tem limitações em mobile. `@dnd-kit/core` é:
- Leve (~15kb)
- Moderno (ativamente mantido)
- Boa API pra listas ordenáveis
- Funciona bem em mobile

### 6.2 Pacotes necessários

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

| Pacote | Função |
|--------|--------|
| `@dnd-kit/core` | DragContext, useDraggable, useDroppable |
| `@dnd-kit/sortable` | SortableContext, useSortable, arrayMove |
| `@dnd-kit/utilities` | CSS.Transform, restrictToVerticalAxis |

### 6.3 Fases de implementação

#### Fase 6.3.1: Instalar pacotes ✅

```bash
cmd /c "cd C:\Caio\SHPL && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities"
```

Feito — ver `package.json`.

#### Fase 6.3.2: Verificar tipos TypeScript ✅

```bash
cmd /c "cd C:\Caio\SHPL && npx tsc --noEmit"
```

Rodado após a instalação: 0 erros.

#### Fase 6.3.3: Commit separado

```bash
git add package.json package-lock.json
git commit -m "chore: add @dnd-kit dependencies for drag-and-drop"
git push
```

Ainda não commitado — combinado não commitar sem aprovação explícita do Caio.

---

## Funcionalidade 7: Número de lugares configurável por mesa (8/10/12)

> **⚠️ Status: parcialmente implementado em 04/08/2026, e será revisado pela Funcionalidade 9.**
> A versão implementada trata a contagem de lugares como **única por etapa** (uma mesa só). Depois que o Caio pediu suporte a até 2 mesas com contagens independentes (Funcionalidade 9), esse dado precisa passar de "um valor por etapa" pra "um valor por mesa". Ver seção 7.4 pra saber exatamente o que já existe e o que a Funcionalidade 9 vai precisar mexer de novo.

### 7.1 Problema atual

O número de lugares da mesa era fixo em **8**, definido pela constante `LIVE_LAB_TOTAL_TABLE_SEATS` em `src/lib/live-lab/stage-runtime-shared.ts`. Não existia nenhum lugar pra guardar quantos lugares uma etapa específica tinha — todas as etapas usavam o mesmo valor fixo, e as coordenadas visuais de cada lugar (`getSeatPosition`) só existiam pra 8 posições.

### 7.2 Solução

Deixar o dealer escolher, na tela de setup da etapa (`stage-setup-screen`), quantos lugares a mesa vai ter, com um seletor entre três opções fixas: **8, 10 ou 12** lugares.

**Regra de aumento:** o número de lugares pode **aumentar durante a etapa, mas nunca diminuir**. Depois que a etapa já começou com um valor (ex: 8), as opções menores ficam desabilitadas no seletor — só é possível ir pra 10 ou 12, nunca voltar. Isso evita ter que decidir o que fazer com jogadores já sentados em lugares que deixariam de existir. Essa regra vale por mesa (ver Funcionalidade 9).

### 7.3 Fases de implementação

#### Fase 7.3.1: Guardar a contagem de lugares como parte do estado ao vivo da etapa ✅

**Decisão tomada na implementação:** em vez de adicionar um campo em `Stage` (`src/lib/domain/types.ts`), a contagem de lugares foi tratada como uma configuração **ao vivo da etapa**, no mesmo padrão já usado por `blindLevels`, `clockSeconds`, `breakDurationMinutes` — que também não vivem no tipo `Stage`, e sim só no `StoredStageRuntimePayload` (o runtime que já é salvo continuamente, ver Funcionalidade 8). `Stage` continua só com metadado de agendamento (id, título, data, status). Isso evitou mexer no repositório/banco pra algo que já tinha um padrão de persistência pronto.

**Arquivo:** `src/lib/live-lab/stage-runtime-shared.ts`
- `LIVE_LAB_TABLE_SEAT_OPTIONS = [8, 10, 12] as const` — as opções válidas.
- `normalizeTableSeatCount(value)` — valida contra as opções, default `8`.
- `StoredStageRuntimePayload.tableSeatCount?: number` — novo campo, normalizado com default `8` em `normalizeStageRuntimePayload` (compatível com etapas salvas antes dessa mudança).

#### Fase 7.3.2: Tornar o total de lugares dinâmico ✅

**Arquivo:** `src/lib/live-lab/stage-runtime-shared.ts`
- `normalizeSeatAssignments(assignments, seatCount = LIVE_LAB_TOTAL_TABLE_SEATS)` — deixou de usar o total fixo, passa a receber a contagem como parâmetro.

**Arquivo:** `src/lib/live-lab/stage-runtime-link.ts`
- As duas chamadas de `normalizeSeatAssignments` (usadas pela tela de transmissão) passam a repassar `parsed.tableSeatCount`.

**Arquivo:** `src/components/stage-setup-screen.tsx`
- A constante local `TOTAL_TABLE_SEATS` foi removida e virou state: `const [tableSeatCount, setTableSeatCount] = useState(LIVE_LAB_TOTAL_TABLE_SEATS)`.
- `buildStageRuntimePayload` e `applyStageRuntimePayload` (hidratação/salvamento) passaram a incluir `tableSeatCount`.
- Todos os pontos que chamavam `normalizeSharedSeatAssignments(...)` sem passar a contagem (havia 4: resumo da mesa, troca direta de assento, undo, e o próprio `TableSeatMap`) foram corrigidos pra usar `tableSeatCount` — sem essa correção, qualquer um desses pontos truncaria a mesa de volta pra 8 lugares silenciosamente.
- Nova função `handleTableSeatCountChange(nextCount)`, que só aplica a mudança se `nextCount > tableSeatCount` (trava de só aumentar), cresce o array de `seatAssignments` e registra no log da etapa.

#### Fase 7.3.3: Seletor de lugares na UI ✅

Adicionado na seção "Posições da mesa", ao lado do texto de status da mesa: 3 botões (`8` / `10` / `12`), com o valor atual destacado e as opções menores que o valor atual desabilitadas visualmente (`opacity-40`, `cursor-not-allowed`).

> Esse seletor único vai precisar virar **um seletor por mesa** quando a Funcionalidade 9 (mesas múltiplas) for implementada — ver 7.4 e a seção 9.

#### Fase 7.3.4: Posições visuais dos lugares na mesa — implementado ✅

**Arquivo:** `src/components/stage-setup-screen.tsx` (`getSeatPosition`, `getTableShape`, `TableSeatMap`)

O Caio ajustou as coordenadas num protótipo com drag-and-drop (arrastando cada lugar pra posição desejada) e depois eu simetrizei os pares/fileiras que ficaram levemente desalinhados. Layouts finais, já implementados em código:

**8 lugares (sem mudança) — mesa oval:**

| Lugar | CSS |
|---|---|
| 1 | `top: 8%, left: 50%, transform: translate(-50%, 0)` |
| 2 | `top: 18%, right: 14%` |
| 3 | `top: 50%, right: 4%, transform: translate(0, -50%)` |
| 4 | `bottom: 18%, right: 14%` |
| 5 | `bottom: 8%, left: 50%, transform: translate(-50%, 0)` |
| 6 | `bottom: 18%, left: 14%` |
| 7 | `top: 50%, left: 4%, transform: translate(0, -50%)` |
| 8 | `top: 18%, left: 14%` |

**10 lugares — mesa oval, mesmo formato do 8.** Só os lugares 1, 5, 6 e 10 (o topo e a base, que tinham 1 lugar central cada e passaram a ter 2) foram reposicionados; os outros 6 (diagonais e centrais laterais) continuam idênticos ao layout de 8.

| Lugar | CSS | Observação |
|---|---|---|
| 1 | `top: 14.8%, left: 55%` | era o lugar 1, puxado pro lado |
| 2 | `top: 18.1%, left: 73.5%` | sem mudança |
| 3 | `top: 43.7%, left: 83.5%` | sem mudança |
| 4 | `top: 69.3%, left: 73.5%` | sem mudança |
| 5 | `top: 71.3%, left: 54.3%` | **novo**, entre o antigo 4 e o antigo 5 |
| 6 | `top: 71.3%, left: 33.3%` | era o lugar 5, puxado pro lado |
| 7 | `top: 69.3%, left: 14.1%` | sem mudança |
| 8 | `top: 43.7%, left: 4.1%` | sem mudança |
| 9 | `top: 18.1%, left: 14.1%` | sem mudança |
| 10 | `top: 14.8%, left: 32.6%` | **novo**, entre o antigo 8 e o antigo 1 |

**12 lugares — muda de formato: mesa retangular.** 5 lugares em cada lado comprido (topo e base) e 1 lugar em cada ponta (esquerda e direita) — `5 + 5 + 1 + 1 = 12`. Esse formato retangular só vale pra opção de 12; os layouts de 8 e 10 continuam ovais.

| Lugar | CSS |
|---|---|
| 1 | `top: 21.4%, left: 9.6%` |
| 2 | `top: 21.4%, left: 26.7%` |
| 3 | `top: 21.4%, left: 43.8%` |
| 4 | `top: 21.4%, left: 60.9%` |
| 5 | `top: 21.4%, left: 78%` |
| 6 | `top: 43.7%, left: 86.8%` |
| 7 | `top: 66%, left: 78%` |
| 8 | `top: 66%, left: 60.9%` |
| 9 | `top: 66%, left: 43.8%` |
| 10 | `top: 66%, left: 26.7%` |
| 11 | `top: 66%, left: 9.6%` |
| 12 | `top: 43.7%, left: 0.8%` |

**Implementação:**
- `SEAT_POSITIONS_BY_COUNT` — mapa `{ 8: [...], 10: [...], 12: [...] }` com as coordenadas acima.
- `getSeatPosition(seatIndex, seatCount)` — troca a lista fixa de 8 posições por essa tabela, indexada pela contagem de lugares.
- `getTableShape(seatCount)` — retorna `"rect"` só para 12, `"oval"` para 8/10.
- `TableSeatMap` passou a receber a prop `seatCount` (vem do state `tableSeatCount`) e renderiza duas variantes do contorno da mesa (oval vs retangular) condicionalmente, além de repassar `seatCount` pro `getSeatPosition` de cada lugar.

Verificado com `npx tsc --noEmit` → 0 erros. Não foi possível testar visualmente no navegador nessa sessão porque a tela exige login.

Protótipo interativo usado pra aprovar as coordenadas: [Mesa — Editor de posições](https://claude.ai/code/artifact/e6ba0722-3ebc-4773-baf4-987c4a4301d6)

#### Fase 7.3.5: Testar cenários

- [ ] Etapa nova → padrão 8 lugares
- [ ] Trocar pra 10 durante a etapa → lugares 9 e 10 aparecem vazios, mesa não perde ninguém, formato continua oval, posições batem com a tabela acima
- [ ] Trocar pra 12 → mesa muda de oval pra retangular, lugares 9-12 aparecem vazios, posições batem com a tabela acima
- [ ] Tentar voltar de 10 pra 8 → opção deve estar desabilitada
- [ ] Etapa antiga (sem `tableSeatCount` salvo) → continua funcionando com 8 lugares

*(Ainda não testado manualmente no navegador — pendente de login pra validar visualmente.)*

### 7.4 O que já está implementado, e o que a Funcionalidade 9 vai revisar

**Feito (verificado com `npx tsc --noEmit`, 0 erros):**
- `LIVE_LAB_TABLE_SEAT_OPTIONS`, `normalizeTableSeatCount`, `normalizeSeatAssignments` dinâmico ([stage-runtime-shared.ts](src/lib/live-lab/stage-runtime-shared.ts))
- `tableSeatCount` no `StoredStageRuntimePayload`, com default `8`
- State `tableSeatCount` em `stage-setup-screen.tsx`, plugado no salvamento contínuo e na hidratação
- Seletor `8 / 10 / 12` na UI, com trava de só aumentar
- Coordenadas finais de 8/10/12 aprovadas (fase 7.3.4 acima)

- Coordenadas finais de 8/10/12 implementadas em `getSeatPosition`/`getTableShape`/`TableSeatMap` (fase 7.3.4)

**Pendente, e por que a Funcionalidade 9 vai mexer de novo nisso:**
- Hoje `tableSeatCount` e `seatAssignments` são **um valor único pra etapa inteira** (uma mesa). A Funcionalidade 9 precisa deles **por mesa** (até 2). Isso significa envolver os dois num array (`tables: Array<{ seatCount; seatAssignments }>`), o que muda a forma de `StoredStageRuntimePayload`, o seletor da UI (que vira um dropdown por mesa, não um controle único), e o `getSeatPosition`/`TableSeatMap` (que passam a renderizar N mesas). Isso é retrabalho esperado — a contagem configurável de lugares (Func. 7) foi implementada antes de "2 mesas" (Func. 9) ter sido definido como requisito.

---

## Funcionalidade 8: Indicador de salvamento contínuo durante a partida

> **✅ Concluído em 04/08/2026.** O painel da mesa agora mostra um indicador permanente de salvamento (`Salvo as HH:MM`, `Salvando...` ou erro local). Também foi adicionado um gatilho de sincronização urgente para eventos críticos: iniciar partida, iniciar próxima partida, eliminar jogador, fechar partida e decisões do jogador atrasado.

### 8.1 Problema atual

O app **já salva continuamente** durante a partida — não é só no final. Toda mudança de estado (pontos, jogadores, lugares na mesa, cronômetro, etc.) já:

- Grava no `localStorage` na hora ([stage-setup-screen.tsx:405-417](src/components/stage-setup-screen.tsx:405)).
- Manda pro servidor (`/api/shpl-admin/stage-session`) com debounce de 250ms (parado) ou 900ms (cronômetro rodando).
- Tenta de novo até 3x com backoff se falhar.
- Tenta salvar de última hora via `navigator.sendBeacon` no `beforeunload` (fechou a aba).

**O problema é só de visibilidade.** O indicador de status ([stage-setup-screen.tsx:1852-1857](src/components/stage-setup-screen.tsx:1852)) só mostra texto quando está `"Salvando..."` (passa rápido) ou quando dá erro. Quando salva com sucesso, **não aparece nada** — o dealer nunca vê uma confirmação positiva de que os dados estão seguros, só a ausência de erro. Isso passa a sensação de que só salva no final, quando na verdade já salva várias vezes durante a partida.

### 8.2 Solução

1. **Indicador permanente com horário do último salvamento** — trocar o texto condicional por um indicador sempre visível com 3 estados: `Salvo às 14:32` / `Salvando...` / `Erro ao salvar — dados salvos localmente`.
2. **Salvar imediatamente em eventos críticos**, sem esperar o debounce — jogador saiu da partida, partida iniciada, partida encerrada. Esses momentos não devem esperar 250-900ms na fila.

### 8.3 Fases de implementação

#### Fase 8.3.1: Expor horário do último salvamento no estado ✅

**Arquivo:** `src/components/stage-setup-screen.tsx`

Hoje já existe uma ref (`lastSyncedAtRef`) guardando o `updatedAt` do último salvamento bem-sucedido (linha 454), mas ela não é state — não dispara re-render, então não pode ser lida direto no JSX.

- Adicionar `const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);`
- Toda vez que `lastSyncedAtRef.current` é atualizado (linha 454), chamar também `setLastSyncedAt(...)` com o mesmo valor.

#### Fase 8.3.2: Atualizar o indicador na UI ✅

**Arquivo:** `src/components/stage-setup-screen.tsx`, por volta da linha 1852

```tsx
{syncStatus === "saving" && (
  <p className="mt-1 text-xs text-[rgba(236,225,196,0.45)]">Salvando...</p>
)}
{syncStatus === "saved" && lastSyncedAt && (
  <p className="mt-1 text-xs text-[rgba(129,211,120,0.7)]">
    Salvo às {formatTimeLabel(lastSyncedAt)}
  </p>
)}
{syncStatus === "error" && (
  <p className="mt-1 text-xs text-[rgba(255,132,92,0.8)]">Erro ao salvar — dados salvos localmente</p>
)}
```

Precisa de uma função `formatTimeLabel()` (ou reaproveitar alguma já existente de formatação de hora) pra converter o ISO string em `HH:MM`.

#### Fase 8.3.3: Criar gatilho de salvamento urgente ✅

**Arquivo:** `src/components/stage-setup-screen.tsx`

Em vez de extrair todo o POST para uma função nova, a implementação manteve o `useEffect` de sincronização atual e adicionou `requestImmediateRuntimeSync()`. Esse gatilho marca a próxima sincronização como urgente e troca o debounce padrão (`250ms`/`900ms`) por `0ms`, reaproveitando a mesma lógica de retries, `updatedAt`, `syncStatus` e persistência local já existente.

#### Fase 8.3.4: Disparar salvamento imediato nos eventos críticos ✅

Chamar `requestImmediateRuntimeSync()` antes das mutações de estado nas seguintes funções:
- `handlePlayerOutFromMatch()` (jogador saiu da partida)
- `closeCurrentMatchAsFinished()` (partida encerrada)
- `performStartCurrentMatch()` / `performStartNextMatch()` (partida iniciada)
- `handleLatePlayerJoinNow()` / `handleLatePlayerJoinNextMatch()` (decisão do jogador atrasado)

#### Fase 8.3.5: Testar cenários

- Eliminar um jogador → indicador mostra "Salvando..." e depois "Salvo às HH:MM" rapidamente, sem esperar o debounce padrão
- Deixar o app parado → indicador mostra o horário do último salvamento, não fica em branco
- Derrubar a conexão → indicador mostra erro, dados continuam no localStorage
- Reconectar → próxima mudança sincroniza e atualiza o horário

---

## Funcionalidade 9: Mesas múltiplas (até 2 mesas por etapa)

> **✅ Concluído em 04/08/2026.** Implementado `tables[]` no runtime com migração automática do formato legado (`tableSeatCount`/`seatAssignments`), UI para 1 ou 2 mesas, seletor 8/10/12 independente por mesa, remoção cruzada de jogador ao mover entre mesas e contexto de transmissão com `tables[]` + lista plana compatível. `cmd /c npx tsc --noEmit` e `cmd /c npm run build` passaram.

### 9.1 Contexto

Hoje uma etapa só tem uma mesa física (um único `seatAssignments`, uma única contagem de lugares — Funcionalidade 7). O Caio quer poder rodar uma etapa com **até 2 mesas físicas separadas**, cada uma com sua própria quantidade de lugares (8/10/12, escolhida de forma independente).

**Modelo confirmado com o Caio:** as 2 mesas fazem parte da **mesma partida** — pontuação, cronômetro e blind continuam únicos pra etapa inteira. As mesas são só uma forma de organizar fisicamente onde cada jogador senta (útil quando tem gente demais pra caber numa mesa só). Não são 2 partidas paralelas — isso simplifica bastante a implementação, porque toda a lógica de partida (Funcionalidades 1-5), pontos e fechamento continua exatamente como já planejado, sem duplicar.

**Onde se configura:** dentro da mesma área de "escolha de lugares da partida" (a seção "Posições da mesa" da Funcionalidade 7) — um controle pra escolher **quantas mesas** (1 ou 2) e, junto de cada mesa, um **dropdown independente** com a quantidade de lugares daquela mesa (8/10/12). Protótipo aprovado com esse exato modelo de interação: [Mesa — Layouts 8/10/12 e mesas múltiplas](https://claude.ai/code/artifact/e6ba0722-3ebc-4773-baf4-987c4a4301d6) (alternar "1 mesa" / "2 mesas" no topo).

### 9.2 Modelo de dados

Substitui os campos únicos `tableSeatCount` / `seatAssignments` (Funcionalidade 7) por uma lista de mesas:

```typescript
type StageTable = {
  seatCount: 8 | 10 | 12;
  seatAssignments: Array<string | null>;
};

// Em StoredStageRuntimePayload:
tables: StageTable[]; // length 1 ou 2
```

- Etapas antigas (sem `tables` salvo, só `tableSeatCount`/`seatAssignments` do formato anterior) precisam migrar automaticamente pra `tables: [{ seatCount: tableSeatCount ?? 8, seatAssignments }]` na normalização — sem isso, etapas já em andamento perderiam a mesa ao carregar.
- Cada mesa segue a regra de "só aumenta, nunca diminui" (Funcionalidade 7) **independente da outra** — aumentar a Mesa 1 pra 10 não afeta a Mesa 2.
- Reduzir de 2 mesas pra 1 não deve ser permitido depois que a etapa começou, pelo mesmo motivo da trava de lugares: não dá pra decidir o que fazer com quem já está sentado na mesa que sumiria. (A decidir com o Caio antes de implementar — ver 9.5.)

### 9.3 Mudanças na UI

**Arquivo:** `src/components/stage-setup-screen.tsx`

- Controle "Quantidade de mesas" (1 / 2) no topo da seção "Posições da mesa".
- Quando 2 mesas: a seção duplica — "Mesa 1" e "Mesa 2" lado a lado (ou empilhadas no mobile), cada uma com seu próprio `TableSeatMap`, seu próprio dropdown de lugares (8/10/12) e sua própria lista de "jogador selecionado / lugar selecionado".
- `selectedSeatIndex` precisa virar `selectedTableIndex` + `selectedSeatIndex`, já que o mesmo índice de lugar existe em duas mesas diferentes agora.
- `handleDirectSeatAssignmentChange`, `getAvailableSeats` (Funcionalidade 3) e `buildSeatPlayerOptions` passam a receber qual mesa está sendo editada.
- Um jogador só pode estar em **uma mesa por vez** — trocar um jogador de mesa precisa remover ele da mesa antiga antes de sentar na nova (mesma lógica que já existe hoje pra não duplicar jogador em 2 lugares da mesma mesa, só que agora cruzando mesas).

### 9.4 Impacto nas outras funcionalidades

- **Funcionalidade 3 (jogador atrasado):** `LatePlayerModal` precisa perguntar não só o lugar, mas **em qual mesa** o jogador vai sentar (quando houver 2 mesas ativas).
- **Funcionalidade 1 (modal de resultado):** não muda — a lista de jogadores pro modal continua vindo de `players` (pontos), independente de mesa.
- **Tela de transmissão** (`stage-runtime-link.ts`): hoje lê um `seatAssignments` só; precisa passar a ler `tables[]` e decidir como exibir 2 mesas (provavelmente lado a lado, como no protótipo).

### 9.5 Decisões em aberto antes de implementar

- Reduzir de 2 mesas pra 1 depois que a etapa começou: permitir, bloquear, ou só permitir se a mesa que seria removida estiver vazia?
- Quando o dealer aumenta pra 2 mesas no meio da etapa, jogadores já sentados na "Mesa 1" continuam lá, e a "Mesa 2" nasce vazia — confirmar que é esse o comportamento esperado.

### 9.6 Fases de implementação

1. Migrar o modelo de dados (`tableSeatCount`/`seatAssignments` → `tables: StageTable[]`), com normalização compatível com etapas salvas no formato antigo.
2. Adicionar o controle de quantidade de mesas (1/2) na UI.
3. Duplicar a seção "Posições da mesa" por mesa, com dropdown de lugares independente.
4. Adaptar `selectedSeatIndex`, `handleDirectSeatAssignmentChange`, `getAvailableSeats`, `buildSeatPlayerOptions` pra trabalhar com múltiplas mesas.
5. Atualizar `LatePlayerModal` (Funcionalidade 3) pra perguntar a mesa também.
6. Atualizar a tela de transmissão pra exibir as 2 mesas.
7. Testar cenários (ver 9.7).

### 9.7 Testar cenários

- Etapa nova → 1 mesa, 8 lugares (padrão)
- Aumentar pra 2 mesas → Mesa 2 nasce vazia, Mesa 1 mantém os jogadores
- Mesa 1 com 10 lugares e Mesa 2 com 8 ao mesmo tempo → cada uma trava só a própria contagem
- Jogador sentado na Mesa 1 é movido pra Mesa 2 → sai da Mesa 1 corretamente
- Etapa antiga (formato de mesa única) → migra pra `tables: [{ ... }]` sem perder assentos
- Tela de transmissão mostra as 2 mesas corretamente

---

## Ordem de implementação

| Fase | Funcionalidade | Dependências | Status |
|------|---------------|-------------|--------|
| 1 | Instalar @dnd-kit | Nenhuma | ✅ Feito |
| 2 | BUG fix: último jogador = 1º lugar | Nenhuma | ✅ Feito |
| 3 | Criar componente MatchResultModal | @dnd-kit | ✅ Feito |
| 4 | Integrar modal no fluxo de fechamento | MatchResultModal | ✅ Feito |
| 5 | Criar componente LatePlayerModal | Nenhuma | ✅ Feito |
| 6 | Integrar modal de jogador atrasado | LatePlayerModal | ✅ Feito |
| 7 | Auto-close mostra modal | MatchResultModal | ✅ Feito |
| 8 | Remover seção "Correção manual" | MatchResultModal integrado | ✅ Feito |
| 8b | Confirmar resultado da etapa com ranking arrastável | MatchResultModal integrado | ✅ Feito |
| 9 | Número de lugares configurável (8/10/12) — dado + lógica | Nenhuma | ✅ Feito (mesa única) |
| 10 | Posições visuais dos lugares (10 e 12) | Definição do Caio (Fase 7.3.4) | ✅ Feito |
| 11 | Mesas múltiplas (até 2, contagem por mesa) | Fases 9/10 acima | ✅ Feito |
| 12 | Indicador de salvamento contínuo | Nenhuma | ✅ Feito |
| 13 | Testar compilação TypeScript | Tudo | ✅ Feito |
| 14 | Testar fluxos completos | Tudo | Planejado |
| 15 | Commit + push | Tudo | Planejado |

---

## Riscos e mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Drag-and-drop não funciona bem em mobile | Alto | Testar cedo em dispositivo real. Usar touch events do @dnd-kit |
| Performance com muitos jogadores | Baixo | Lista limitada a ~20 jogadores (realista pra poker) |
| Estado do modal fica dessincronizado | Médio | Usar key={matchIndex} pra forçar remount |
| Mudanças no state durante drag causam bugs | Médio | Só aplicar resultado no "Confirmar", não durante drag |
| Auto-close abre modal infinitamente | Baixo | Guard: só abre se `!showMatchResultModal` |

---

## Arquivos afetados

| Arquivo | Ação | Mudanças | Status |
|---------|------|----------|--------|
| `package.json` | Modificar | +3 dependências (`@dnd-kit/*`) | ✅ Feito |
| `src/components/match-result-modal.tsx` | **Criar** | Componente novo (~300 linhas) | ✅ Feito |
| `src/components/late-player-modal.tsx` | **Criar** | Componente novo (~200 linhas) | ✅ Feito |
| `src/components/stage-setup-screen.tsx` | Modificar | ~150 linhas removidas, ~200 adicionadas (Func. 1-5, 5b, 8); seletor de lugares + state `tableSeatCount` (Func. 7) | Parcial |
| `src/components/stage-result-modal.tsx` | **Criar** | Modal novo para confirmar ranking final da etapa antes de encerrar | ✅ Feito |
| `src/lib/domain/rules.ts` | Não alterar | `calculateMatchPoints` já existe | — |
| `Docs/AUDITORIA-PERSISTENCIA.md` | Modificar | Atualizar status | Planejado |
| `src/lib/live-lab/stage-runtime-shared.ts` | Modificar | `normalizeSeatAssignments` dinâmico, `LIVE_LAB_TABLE_SEAT_OPTIONS`, `normalizeTableSeatCount`, campo `tableSeatCount` no payload | ✅ Feito |
| `src/lib/live-lab/stage-runtime-link.ts` | Modificar | Repassar `tableSeatCount` pra `normalizeSeatAssignments` | ✅ Feito |
| `src/lib/domain/types.ts` | ~~Modificar~~ Não alterar | Decisão revista: `tableSeatCount` fica só no runtime payload, não em `Stage` (ver Fase 7.3.1) | — |
| `src/components/stage-setup-screen.tsx` (Func. 9) | Modificar | `tables: StageTable[]` no lugar de `tableSeatCount`/`seatAssignments` únicos; UI duplicada por mesa | ✅ Concluído |

---

## Coordenadas dos layouts de mesa (8 / 10 / 12)

Referência rápida das coordenadas finais **já implementadas** em `getSeatPosition` — o detalhamento completo, com o porquê de cada uma, está na Fase 7.3.4. Protótipo interativo usado pra chegar nelas: [Mesa — Editor de posições](https://claude.ai/code/artifact/e6ba0722-3ebc-4773-baf4-987c4a4301d6).

- **8 lugares:** mesa oval, layout atual em produção — sem mudanças.
- **10 lugares:** mesa oval. Lugares 5 e 10 são novos (entre o antigo-4/antigo-5 e o antigo-8/antigo-1, respectivamente); os lugares 1 e 6 são os antigos 1 e 5 puxados pro lado pra abrir espaço.
- **12 lugares:** mesa retangular. 5 lugares em cada lado comprido (1-5 no topo, 7-11 na base) + 1 lugar em cada ponta (6 na direita, 12 na esquerda).

---

## Checklist de validação

> **Auditoria em 04/08/2026:** além de `tsc`, `lint` e `build`, foram corrigidos pontos encontrados na revisão: o 2º lugar escolhido no modal de acordo agora pré-ordena o `MatchResultModal`, o assento selecionado é ajustado pela mesa selecionada ao hidratar/trocar mesas, e os warnings antigos de lint foram removidos. Depois da revisão de fluxo, o `LatePlayerModal` passou a exigir escolha explícita de Mesa/Lugar pelo dealer/admin, sem assento automático.

> **Ajuste de fluxo em 04/08/2026:** ao clicar em `INICIAR` ou `INICIAR PROXIMA PARTIDA` com jogadores aptos sem lugar, a tela agora abre um modal de configuração de lugares. O dealer/admin escolhe Mesa/Lugar para cada jogador faltante e só então pode iniciar a partida.

> **Teste funcional no navegador em 04/08/2026:** login local com fallback demo, abertura da Etapa 06, buy-ins, 2 mesas, Mesa 1 com 10 lugares, assentos em mesas diferentes, início de partida, indicador `Salvo às HH:MM`, `LatePlayerModal` nos caminhos "entrar agora" e "ficar para próxima", fechamento de partida via `MatchResultModal`, pontuação 10/8/6/4/0 aplicada, `StageResultModal`, confirmação administrativa final e console sem erros. Dados locais e `.env.local` foram restaurados após o teste.

- [x] `npx tsc --noEmit` → 0 erros *(checado após Func. 6 e 7 parcial — precisa rodar de novo a cada nova fase)*
- [x] `npx next build` → build limpo
- [ ] Drag-and-drop funciona em desktop (mouse)
- [ ] Drag-and-drop funciona em mobile (touch)
- [x] Pontos são calculados corretamente (10/8/6/4/2) *(validado no navegador com 10/8/6/4/0; 5º+=2 coberto pela regra existente, ainda sem cenário manual com 5º participante pontuando)*
- [x] Último jogador recebe 10 pts automaticamente
- [x] Auto-close abre modal (não fecha direto)
- [x] Modal de jogador atrasado aparece durante partida
- [x] "Só na próxima" = 0 pts
- [x] `LatePlayerModal` exige escolha manual de Mesa/Lugar antes de "Confirmar entrada"
- [x] Seção "Correção manual" foi removida
- [x] Nenhum código morto ficou pra trás
- [ ] Commit limpo e descritivo
- [x] Seletor de lugares mostra 8/10/12 e trava opções menores que o valor atual *(implementado pra mesa única — revisar quando virar por mesa, Func. 9)*
- [x] Etapa antiga sem `tableSeatCount` continua funcionando com 8 lugares
- [x] Posições visuais de 10 e 12 lugares definidas pelo Caio e aplicadas no `getSeatPosition`/`getTableShape` (Fase 7.3.4) — falta testar visualmente no navegador (pendente de login)
- [x] Indicador mostra "Salvo às HH:MM" quando não está salvando nem com erro
- [x] Eventos críticos (jogador saiu, partida iniciada/encerrada) salvam sem esperar o debounce padrão
- [x] Quantidade de mesas (1/2) configurável, cada mesa com dropdown de lugares independente
- [x] Clicar em `INICIAR`/`INICIAR PROXIMA PARTIDA` com lugares incompletos abre modal para configurar assentos
- [x] Mesa 1 com uma contagem e Mesa 2 com outra funcionam simultaneamente sem conflito
- [x] Etapa no formato antigo (mesa única) migra pra `tables[]` sem perder assentos
- [x] `getSeatPosition` aplica o layout retangular só quando a contagem é 12

---

## Ordem de implementação revisada (evita retrabalho)

A tabela "Ordem de implementação" lá em cima segue a ordem em que as funcionalidades foram documentadas, não a ordem ideal de implementação. Analisando as dependências reais entre elas, dá pra ver dois pontos onde implementar na ordem "documentada" geraria trabalho duplicado:

1. **Feature 3 (LatePlayerModal) usa `getAvailableSeats()`, que depende de quantos lugares a mesa tem.** Se essa função for escrita antes da Feature 7 (lugares configuráveis) tornar isso dinâmico, ela vai ter que ser reescrita depois. Resolve fazendo a parte de dados/lógica da Feature 7 **antes** da Feature 3.

2. **Feature 2 (bug do último jogador) e Feature 4 (auto-close) mexem exatamente nos mesmos pontos que a Feature 1 (Modal de resultado) reescreve na hora de integrar o modal** (`closeCurrentMatchAsFinished`, `handleCloseCurrentMatch`, o `useEffect` de auto-close). Se a Feature 2 for implementada isolada primeiro, e depois a Feature 1 reescrever esses mesmos pontos pra abrir o modal, o código da Feature 2 fica praticamente descartado. Resolve implementando a Feature 1 primeiro — o modal, ao exigir confirmação manual do dealer antes de fechar qualquer partida (inclusive quando sobra 1 jogador), já resolve o bug da Feature 2 como consequência natural, sem precisar escrever e depois jogar fora uma correção separada. A Feature 4 (auto-close) também fica mais simples depois, porque é só trocar a chamada do `useEffect` pra abrir um modal que já existe.

3. **Feature 9 (mesas múltiplas) foi definida depois da Feature 7 já estar parcialmente implementada.** A Feature 7 tratou a contagem de lugares como um valor único pra etapa; a Feature 9 precisa dela por mesa (até 2). Isso significa que, quando a Feature 9 entrar, ela vai envolver `tableSeatCount`/`seatAssignments` num array `tables[]` — um retrabalho já esperado e documentado na Fase 7.4. Dá pra minimizar isso implementando a Feature 9 logo depois da Feature 7, antes de mais coisas passarem a depender do formato de mesa única (ex: a Feature 3, se ainda não tiver sido feita).

### Ordem sugerida

| Ordem | Passo | Por quê nessa posição | Status |
|---|---|---|---|
| 1 | Instalar `@dnd-kit` (Feature 6) | Pré-requisito de tudo relacionado ao modal de resultado | ✅ Feito |
| 2 | Lugares configuráveis 8/10/12 — dado + lógica (Feature 7, fases 7.3.1–7.3.3) | Feature 3 depende disso; fazer antes evita reescrever `getAvailableSeats()` depois | ✅ Feito (mesa única) |
| 2b | Posições visuais 8/10/12 (Feature 7, fase 7.3.4) | Coordenadas já definidas e aprovadas pelo Caio | ✅ Feito — `getSeatPosition`/`getTableShape` atualizados |
| 3 | Mesas múltiplas — modelo de dados + UI (Feature 9) | Fazer logo após a Feature 7, antes da Feature 3 depender do formato de mesa única — evita o retrabalho descrito no ponto 3 acima | ✅ Feito |
| 4 | Criar `MatchResultModal` (Feature 1, fases 1.4.2–1.4.5) | Componente novo, sem dependência de outras features além do dnd-kit | ✅ Feito |
| 5 | Integrar modal no fluxo de fechamento (Feature 1, fase 1.4.3) | Reescreve `closeCurrentMatchAsFinished`/`handleCloseCurrentMatch` de vez — fazer isso antes da Feature 2 evita retrabalho | ✅ Feito |
| 6 | Validar bug do último jogador (Feature 2) | Depois do passo 5, é só conferir que o modal já cobre o caso — não precisa mais reescrever `closeCurrentMatchAsFinished` isolado | ✅ Feito |
| 7 | Auto-close sempre mostra modal (Feature 4) | Modal já existe (passo 4); só troca a chamada do `useEffect` de auto-close | ✅ Feito |
| 8 | Remover seção "Correção manual" (Feature 5) | Só depois do modal cobrir 100% dos casos que a seção antiga cobria | ✅ Feito |
| 9 | Criar modal "Confirmar resultado da etapa" (Feature 5b) | Depois do modal de partida existir; reaproveita o padrão visual/drag-and-drop | ✅ Feito |
| 10 | Criar e integrar `LatePlayerModal` (Feature 3) | Mesas e lugares (passos 2-3) já prontos — sem retrabalho na lógica de assento/mesa | ✅ Feito |
| 11 | Indicador de salvamento contínuo (Feature 8) | Feito por último, plugado nas versões finais das funções de partida (que já pararam de mudar) | ✅ Feito |
| 12 | `npx tsc --noEmit` → 0 erros | Validação final de tipos | ✅ Feito |
| 13 | Testar fluxos completos (todos os cenários dos checklists de cada feature) | Validação final funcional | Planejado |
| 14 | Commit + push | Fecha o ciclo | Planejado |
