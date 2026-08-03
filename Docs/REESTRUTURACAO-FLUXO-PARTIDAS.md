# Reestruturação do Fluxo de Partidas — SHPL Poker

> Data: 03/08/2026
> Status: Planejamento (aguardando aprovação)
> Autor: Caio + Claude

---

## Sumário

| # | Funcionalidade | Prioridade | Estimativa |
|---|---------------|-----------|-----------|
| 1 | Modal "Definir resultado da partida" | Crítica | Alta |
| 2 | BUG Fix: Último jogador = 1º lugar | Crítica | Baixa |
| 3 | Modal "Jogador atrasado" | Alta | Média |
| 4 | Auto-close sempre mostra modal | Média | Baixa |
| 5 | Remover seção "Correção manual" | Média | Baixa |
| 6 | Dependência: @dnd-kit/core | — | Pré-requisito |

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
      hasParticipated: p.matchPoints[matchIndex] !== undefined && p.matchPoints[matchIndex] > 0,
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

### 2.1 Problema atual

Quando a partida tem apenas 1 jogador restante (os outros saíram), o botão "Fechar partida" aparece. Mas quando o dealer clica, `closeCurrentMatchAsFinished()` **não atribui pontos** pro vencedor.

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
  const totalSeats = 10; // ou configurável
  const assignedSeats = new Set(
    seatAssignments.filter((id): id is string => id !== null)
  );
  
  return Array.from({ length: totalSeats }, (_, i) => ({
    index: i,
    label: `Lugar ${i + 1}`,
  })).filter(seat => !assignedSeats.has(String(seat.index)));
}
```

**Problema:** Os lugares não são numerados por ID, mas por índice no array `seatAssignments`. Precisa mapear corretamente.

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

### 5.1 Problema atual

Existe uma seção "Correção manual" na tela principal que permite editar posições de partidas passadas. Essa seção:

- Fica longe do contexto (embaixo de tudo)
- É confusa (seletor de partida + inputs pra cada jogador)
- Duplica funcionalidade que agora está no modal
-USA `<select>` nativo (não CustomSelect)

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

## Funcionalidade 6: Dependência @dnd-kit/core

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

#### Fase 6.3.1: Instalar pacotes

```bash
cmd /c "cd C:\Caio\SHPL && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities"
```

#### Fase 6.3.2: Verificar tipos TypeScript

```bash
cmd /c "cd C:\Caio\SHPL && npx tsc --noEmit"
```

#### Fase 6.3.3: Commit separado

```bash
git add package.json package-lock.json
git commit -m "chore: add @dnd-kit dependencies for drag-and-drop"
git push
```

---

## Ordem de implementação

| Fase | Funcionalidade | Dependências |
|------|---------------|-------------|
| 1 | Instalar @dnd-kit | Nenhuma |
| 2 | BUG fix: último jogador = 1º lugar | Nenhuma |
| 3 | Criar componente MatchResultModal | @dnd-kit |
| 4 | Integrar modal no fluxo de fechamento | MatchResultModal |
| 5 | Criar componente LatePlayerModal | Nenhuma |
| 6 | Integrar modal de jogador atrasado | LatePlayerModal |
| 7 | Auto-close mostra modal | MatchResultModal |
| 8 | Remover seção "Correção manual" | MatchResultModal integrado |
| 9 | Testar compilação TypeScript | Tudo |
| 10 | Testar fluxos completos | Tudo |
| 11 | Commit + push | Tudo |

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

| Arquivo | Ação | Mudanças |
|---------|------|----------|
| `package.json` | Modificar | +3 dependências |
| `src/components/match-result-modal.tsx` | **Criar** | Componente novo (~300 linhas) |
| `src/components/late-player-modal.tsx` | **Criar** | Componente novo (~200 linhas) |
| `src/components/stage-setup-screen.tsx` | Modificar | ~150 linhas removidas, ~200 adicionadas |
| `src/lib/domain/rules.ts` | Não alterar | `calculateMatchPoints` já existe |
| `Docs/AUDITORIA-PERSISTENCIA.md` | Modificar | Atualizar status |

---

## Checklist de validação

- [ ] `npx tsc --noEmit` → 0 erros
- [ ] `npx next build` → build limpo
- [ ] Drag-and-drop funciona em desktop (mouse)
- [ ] Drag-and-drop funciona em mobile (touch)
- [ ] Pontos são calculados corretamente (10/8/6/4/2)
- [ ] Último jogador recebe 10 pts automaticamente
- [ ] Auto-close abre modal (não fecha direto)
- [ ] Modal de jogador atrasado aparece durante partida
- [ ] "Só na próxima" = 0 pts
- [ ] Seção "Correção manual" foi removida
- [ ] Nenhum código morto ficou pra trás
- [ ] Commit limpo e descritivo
