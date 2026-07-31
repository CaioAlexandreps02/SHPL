# SHPL — Overrides Manuais Planejados

> Documento de especificação das 5 funcionalidades de override manual a serem implementadas no SHPL.
> Criado em 31/07/2026.

---

## Índice

1. [Penalidade de saída da etapa](#1-penalidade-de-saída-da-etapa)
2. [Contribuição anual da etapa](#2-contribuição-anual-da-etapa)
3. [Premiação do dia](#3-premiação-do-dia)
4. [Fechamento automático da partida](#4-fechamento-automático-da-partida)
5. [Exclusão de etapa teste do pote/ranking](#5-exclusão-de-etapa-teste-do-poteranking)

---

## 1. Penalidade de saída da etapa

### Como funciona hoje

Quando um jogador é marcado como "Saiu da etapa" (`handleLeaveStage` em `stage-setup-screen.tsx`, linhas ~1339-1377):

1. **Zera todos os pontos** de TODAS as partidas da etapa: `matchPoints: [0, 0, ..., 1]`
2. **Atribui 1 ponto** na partida atual (a partida em que estava jogando quando saiu)
3. O jogador é marcado com `leftStageEarly: true`
4. Na finalização da etapa, o jogador recebe **1 ponto no ranking anual** (independentemente de qualquer coisa)
5. **Não disputa a premiação** da etapa (mesmo que tenha vencido partidas antes de sair)
6. Os stacks estimados do jogador são redistribuídos para os demais (70% pro top, 30% pro segundo)

**Problema:** É uma penalidade fixa e sem flexibilidade. Se o grupo decidir que o jogador pode manter os pontos (ex: saiu por emergência), não há como fazer.

### Como será implementado

#### Interface na tela da mesa

Ao clicar no botão **"Saiu da etapa"** de um jogador, em vez de aplicar a penalidade imediatamente, o sistema exibirá um **painel de confirmação** com as seguintes opções:

```
┌─────────────────────────────────────────────────┐
│  [Nome do jogador] saiu da etapa                │
│                                                 │
│  O que fazer com os pontos desta etapa?         │
│                                                 │
│  ○ Manter todos os pontos                       │
│    O jogador mantém os pontos conquistados.     │
│    Não recebe pontos anuais.                    │
│                                                 │
│  ○ Zerar pontos (penalidade padrão)             │
│    Todos os pontos da etapa são zerados.        │
│    Recebe 1 ponto no ranking anual.             │
│    Não disputa premiação.                       │
│                                                 │
│  ○ Zerar sem ponto anual                        │
│    Todos os pontos da etapa são zerados.        │
│    NÃO recebe nenhum ponto no ranking anual.    │
│                                                 │
│  [Confirmar saída]  [Cancelar]                  │
└─────────────────────────────────────────────────┘
```

#### Alterações no código

**`stage-setup-screen.tsx` — `handleLeaveStage`:**

Hoje:
```typescript
// Zera tudo e atribui 1 ponto
updatedPlayers = players.map(p =>
  p.id === leavingPlayerId
    ? { ...p, matchPoints: Array(p.matchPoints.length).fill(0).map((_, i) => i === currentMatchIndex ? 1 : 0), leftStageEarly: true, outOfCurrentMatch: true }
    : p
);
```

Depois:
```typescript
// Em vez de aplicar direto, abre o painel de confirmação
// O painel passa a opção escolhida para handleLeaveStage
type StageExitPenalty = "keep_points" | "zero_with_annual" | "zero_without_annual";

function handleLeaveStage(leavingPlayerId: string, penalty: StageExitPenalty) {
  if (penalty === "keep_points") {
    // Apenas marca como saiu, NÃO zera pontos
    updatedPlayers = players.map(p =>
      p.id === leavingPlayerId
        ? { ...p, leftStageEarly: true, outOfCurrentMatch: true }
        : p
    );
  } else if (penalty === "zero_with_annual") {
    // Comportamento atual: zera + 1 ponto
    updatedPlayers = players.map(p =>
      p.id === leavingPlayerId
        ? { ...p, matchPoints: [...], leftStageEarly: true, outOfCurrentMatch: true, receivesAnnualPoint: true }
        : p
    );
  } else {
    // zero_without_annual: zera + 0 pontos anuais
    updatedPlayers = players.map(p =>
      p.id === leavingPlayerId
        ? { ...p, matchPoints: [...], leftStageEarly: true, outOfCurrentMatch: true, receivesAnnualPoint: false }
        : p
    );
  }
}
```

**`stage-runtime-shared.ts` — `StoredStageRuntimePayload`:**

Adicionar campo:
```typescript
stageExitPenalty?: StageExitPenalty;  // "keep_points" | "zero_with_annual" | "zero_without_annual"
```

**`demo-league-state.ts` — `finalizeStage`:**

A lógica de atribuição de pontos anuais precisa verificar a penalidade escolhida em vez de apenas `leftStageEarly`:
```typescript
// Hoje:
if (player.leftStageEarly) annualPoints = 1;

// Depois:
if (player.leftStageEarly) {
  annualPoints = player.receivesAnnualPoint ? 1 : 0;
}
```

**`types.ts` — `StagePlayerSnapshot`:**

Adicionar campo opcional:
```typescript
stageExitPenalty?: "keep_points" | "zero_with_annual" | "zero_without_annual";
```

#### Impacto na finalização da etapa

- **"Manter todos os pontos"**: O jogador continua no ranking do dia com seus pontos, mas não recebe pontos anuais e não disputa premiação
- **"Zerar pontos (padrão)"**: Comportamento atual — zera tudo, 1 ponto anual, sem premiação
- **"Zerar sem ponto anual"**: Zera tudo, 0 pontos anuais, sem premiação

---

## 2. Contribuição anual da etapa

### Como funciona hoje

Ao finalizar uma etapa (`finalizeStage` em `demo-league-state.ts`, linhas ~306-314):

```typescript
const annualPaidPlayers = stagePlayers.filter(p => p.annualPaid).length;
const annualContributionCents = stageBuyInAnnualCents * annualPaidPlayers;
```

- O valor é **calculado automaticamente**: buyInAnnual (R$ 10) × número de jogadores que pagaram anual
- Se a etapa for teste (`isTest`), a contribuição é forçada para 0
- O valor é adicionado ao pote anual acumulado
- **Não há como editar** o valor antes de finalizar

**Problema:** Se alguém pagou valor diferente, ou o grupo combinou uma contribuição diferente para aquela etapa, não há como ajustar.

### Como será implementado

#### Interface na tela de finalização da etapa

Ao finalizar uma etapa, o sistema exibirá o **valor calculado automaticamente** mas com campo editável:

```
┌─────────────────────────────────────────────────┐
│  Finalizar etapa: Etapa 05                      │
│                                                 │
│  Contribuição anual do pote                     │
│                                                 │
│  Calculado: R$ 10,00 × 8 pagantes = R$ 80,00   │
│                                                 │
│  Valor da contribuição: [R$ 80,00]  ← editável  │
│                                                 │
│  ⚠ Se o valor for diferente do calculado,       │
│    o sistema sinalizará a diferença.            │
│                                                 │
│  Nota (opcional): [________________]            │
│                                                 │
│  [Confirmar finalização]                        │
└─────────────────────────────────────────────────┘
```

#### Sinalização de débito

O sistema precisará rastrear se **algum jogador ficou devendo** o buy-in anual. Para isso:

**Novo campo no `StagePlayerSnapshot`:**
```typescript
annualPaymentStatus: "paid" | "partial" | "owed";
annualPaymentNote?: string;  // "Pagou R$ 5 dos R$ 10"
```

**Na tela da mesa**, ao confirmar buy-in anual, adicionar opção:

```
┌─────────────────────────────────────────────────┐
│  Buy-in anual — [Nome do jogador]               │
│                                                 │
│  Valor: R$ 10,00                                │
│                                                 │
│  ● Pago integralmente                           │
│  ○ Parcial: [R$ ___]                            │
│  ○ Não pagou (ficou devendo)                    │
│                                                 │
│  Nota: [________________]                       │
│                                                 │
│  [Confirmar]                                    │
└─────────────────────────────────────────────────┘
```

**Na tela de finalização da etapa**, exibir alerta se houver jogadores com débito:

```
┌─────────────────────────────────────────────────┐
│  ⚠ Jogadores com débito anual:                 │
│                                                 │
│  • João: pagou R$ 5 dos R$ 10 (falta R$ 5)     │
│  • Pedro: não pagou (falta R$ 10)               │
│                                                 │
│  Total em aberto: R$ 15,00                      │
│                                                 │
│  A contribuição anual será calculada com:       │
│  R$ 10 × 6 pagantes = R$ 60,00                  │
│  (jogadores com débito não contam)              │
│                                                 │
│  [Continuar]                                    │
└─────────────────────────────────────────────────┘
```

#### Alterações no código

**`demo-league-state.ts` — `finalizeStage`:**

```typescript
// Hoje:
const annualPaidPlayers = stagePlayers.filter(p => p.annualPaid).length;
const annualContributionCents = stageBuyInAnnualCents * annualPaidPlayers;

// Depois:
// O valor pode ser override pelo usuário
const effectiveContributionCents = overrideAnnualContributionCents ?? (stageBuyInAnnualCents * annualPaidPlayers);
```

**Novo tipo:**
```typescript
type FinalizeStageInput = {
  // ... campos existentes
  overrideAnnualContributionCents?: number;  // null = usar cálculo automático
  overrideAnnualContributionNote?: string;
};
```

**`types.ts` — `StagePlayerSnapshot`:**
```typescript
annualPaymentStatus?: "paid" | "partial" | "owed";
annualPaymentNote?: string;
annualPaymentAmount?: number;  // quanto realmente pagou (em centavos)
```

**`demo-admin-store.ts` — StoredPlayer:**
```typescript
annualOwedCents?: number;  // débito acumulado de buy-in anual
```

#### Regras de negócio

1. Jogadores com `annualPaymentStatus: "owed"` ou `"partial"` **não entram na contagem** de pagantes anuais
2. O débito é registrado no player para que possa ser cobrado nas próximas etapas
3. Na próxima etapa, ao marcar buy-in anual, o sistema mostrará: "Este jogador devia R$ X da etapa anterior"
4. A contribuição manual na finalização **não altera** os débitos individuais — apenas o valor total que entra no pote

---

## 3. Premiação do dia

### Como funciona hoje

A premiação do dia é calculada automaticamente:

```typescript
// financial-summary.tsx, linha 104:
const dailyPrizePool = formatCurrency(metrics.dailyPaidPlayers * metrics.buyInDaily);
```

- buyInDaily = R$ 10 (configurável em settings)
- dailyPaidPlayers = contagem de jogadores que pagaram o buy-in diário
- O valor é exibido no card "Arrecadação do dia"
- Na finalização da etapa, o valor é gravado no history: `dailyPrize: formatCurrency(dailyPrizeCents / 100)`
- **Não há como editar** o valor total

**Problema:** Se alguém pagou valor diferente, ou o grupo quer dar um bônus, ou quer dividir de forma diferente, não há como ajustar.

### Como será implementado

#### Interface na tela de finalização da etapa

```
┌─────────────────────────────────────────────────┐
│  Premiação da etapa                             │
│                                                 │
│  Calculado: R$ 10,00 × 7 pagantes = R$ 70,00   │
│                                                 │
│  Valor da premiação: [R$ 70,00]  ← editável     │
│                                                 │
│  ⚠ Se o valor for diferente do calculado,       │
│    o sistema sinalizará a diferença.            │
│                                                 │
│  Nota (opcional): [________________]            │
└─────────────────────────────────────────────────┘
```

#### Alterações no código

**`demo-league-state.ts` — `finalizeStage`:**

```typescript
// Hoje:
const dailyPrizeCents = stageBuyInDailyCents * dailyPaidPlayers;

// Depois:
const effectiveDailyPrizeCents = overrideDailyPrizeCents ?? (stageBuyInDailyCents * dailyPaidPlayers);
```

**Novo tipo:**
```typescript
type FinalizeStageInput = {
  // ... campos existentes
  overrideDailyPrizeCents?: number;
  overrideDailyPrizeNote?: string;
};
```

#### Regras de negócio

1. O campo mostra o valor calculado como **placeholder/sugestão**
2. O usuário pode editar para qualquer valor (incluindo 0)
3. Se editar, o sistema grava a nota opcional e a diferença entre calculado e informado
4. A premiação editada é a que entra no history da etapa
5. **Não afeta** a contribuição anual (que é calculada separadamente)

---

## 4. Fechamento automático da partida

### Como funciona hoje

Quando resta **1 jogador ativo** na partida (`handlePlayerOutFromMatch` em `stage-setup-screen.tsx`, linhas ~1275-1311):

1. O sistema detecta que `activePlayers.length === 1`
2. Atribui automaticamente **10 pontos** (1º lugar) ao jogador restante
3. Marca a partida como `closed`
4. Registra o vencedor no log

Também quando **todos os jogadores são eliminados** ou saem (useEffect, linhas ~874-900):

1. Se `eligiblePlayers.every(p => p.outOfCurrentMatch)`, fecha automaticamente
2. Marca com nota "Fechamento automático: todos os jogadores eliminados"

**Problema:** Não permite acordos entre os últimos jogadores (ex: dividir o prêmio). O dealer não tem controle manual sobre quando a partida termina.

### Como será implementado

#### Comportamento alterado

Quando resta 1 jogador ativo, o sistema **NÃO fecha automaticamente**. Em vez disso:

1. Mostra um **banner de aviso**: "Resta 1 jogador — partida pode ser finalizada"
2. O **botão "Fechar partida"** fica destacado
3. O dealer pode clicar para fechar, ou pode usar o botão "Acordo" para dividir

#### Interface

```
┌─────────────────────────────────────────────────┐
│  ⚠ Partida pode ser finalizada                  │
│                                                 │
│  Jogadores restantes: 1                         │
│                                                 │
│  [Fechar partida]  [Acordo entre jogadores]     │
└─────────────────────────────────────────────────┘
```

**Ao clicar "Fechar partida":**
- Abre modal de confirmação com o vencedor pré-sugerido
- Dealer pode ajustar colocação antes de confirmar

**Ao clicar "Acordo entre jogadores":**
```
┌─────────────────────────────────────────────────┐
│  Acordo entre jogadores                         │
│                                                 │
│  Selecione as colocações:                       │
│                                                 │
│  1º lugar: [Selecione ▾]                       │
│  2º lugar: [Selecione ▾]                       │
│  3º lugar: [Selecione ▾]  (opcional)           │
│                                                 │
│  Dividir premiação?                             │
│  ● Sim, dividir igualmente entre os acordados   │
│  ○ Não, premiar apenas o 1º lugar               │
│                                                 │
│  [Confirmar acordo]                             │
└─────────────────────────────────────────────────┘
```

#### Alterações no código

**`stage-setup-screen.tsx`:**

Remover o auto-fechamento no `handlePlayerOutFromMatch`:
```typescript
// Hoje (dentro do if activePlayers.length === 1):
// Auto-closes the match

// Depois:
// Apenas marca o jogador eliminado, NÃO fecha a partida
// O banner "pode ser finalizada" aparece no JSX
```

Adicionar estado:
```typescript
const [showAgreementModal, setShowAgreementModal] = useState(false);
const [pendingAgreement, setPendingAgreement] = useState<AgreementData | null>(null);
```

Adicionar useEffect para detectar "pode finalizar":
```typescript
const canFinalizeMatch = activePlayers.length <= 1 && !currentMatchClosed;
const lastPlayerStanding = activePlayers.length === 1 ? activePlayers[0] : null;
```

**Novo tipo:**
```typescript
type AgreementData = {
  placements: Array<{ playerId: string; position: number }>;
  splitPrize: boolean;
};
```

#### Regras de negócio

1. Quando `activePlayers.length === 1`, o sistema **sugere** fechar mas não fecha
2. O dealer pode fechar manualmente (com confirmação)
3. O dealer pode registrar um acordo (colocação manual + divisão opcional)
4. Quando `activePlayers.length === 0`, o sistema continua fechando automaticamente (edge case)
5. A partida só é finalizada com ação explícita do dealer

---

## 5. Exclusão de etapa teste do pote/ranking

### Como funciona hoje

Etapa teste (`isTest: true`) é automaticamente excluída de **tudo**:

**Na finalização (`finalizeStage`):**
```typescript
// demo-league-state.ts, linha 314:
const effectiveAnnualContributionCents = stage.isTest ? 0 : annualContributionCents;

// Linha 348-372 (bloco if isTest):
// - NÃO atualiza ranking anual
// - NÃO adiciona ao annual pot
// - Grava history/historyDetail com isTest: true
// - Retorna isTestStage: true
```

**No display:**
- Etapas teste aparecem no histórico com badge "Teste"
- Não contribuem para o pote anual
- Não afetam o ranking anual
- Os pontos da etapa são calculados mas **não são somados** ao total do jogador

**Problema:** Se o grupo decidir que uma etapa teste "vale sim", não há como incluir retroativamente.

### Como será implementado

#### Interface na criação da etapa

Ao criar uma etapa, adicionar checkbox:

```
┌─────────────────────────────────────────────────┐
│  Nova etapa                                     │
│                                                 │
│  Título: [Etapa 06                ]             │
│  Data:   [2026-08-15            ]              │
│                                                 │
│  ☑ Etapa de teste                               │
│    (não conta para ranking anual nem pote)      │
│                                                 │
│  [Criar etapa]                                  │
└─────────────────────────────────────────────────┘
```

#### Interface na finalização da etapa

Ao finalizar uma etapa teste, exibir opção:

```
┌─────────────────────────────────────────────────┐
│  Finalizar etapa de teste: Etapa Teste 01       │
│                                                 │
│  Esta é uma etapa de teste. Por padrão, ela     │
│  não conta para o ranking anual nem para o      │
│  pote anual.                                    │
│                                                 │
│  Incluir nos resultados anuais?                 │
│                                                 │
│  ● Não (padrão) — não afeta ranking nem pote    │
│  ○ Sim — contabiliza pontos e contribuição      │
│                                                 │
│  [Confirmar finalização]                        │
└─────────────────────────────────────────────────┘
```

#### Alterações no código

**`demo-league-state.ts` — `finalizeStage`:**

```typescript
// Hoje:
if (stage.isTest) {
  // ... tudo excluído
  effectiveAnnualContributionCents = 0;
}

// Depois:
const includeInAnnual = stage.isTest ? (overrideIncludeInAnnual ?? false) : true;
const effectiveAnnualContributionCents = includeInAnnual ? annualContributionCents : 0;

// Se includeInAnnual, NÃO entra no bloco de exclusão
// Se !includeInAnnual, entra no bloco de exclusão (comportamento atual)
```

**Novo tipo:**
```typescript
type FinalizeStageInput = {
  // ... campos existentes
  overrideIncludeInAnnual?: boolean;  // só para etapas teste
};
```

**`demo-admin-store.ts` — `StoredStageRecord`:**
```typescript
includeInAnnual?: boolean;  // override para etapas teste
```

#### Regras de negócio

1. Etapa teste com `includeInAnnual: false` (padrão): comportamento atual, excluída de tudo
2. Etapa teste com `includeInAnnual: true`: tratada como etapa normal para ranking e pote
3. A decisão é feita **no momento da finalização**, não na criação
4. Pode ser alterada posteriormente apenas re-finalizando (que não é possível — guard contra duplicata)
5. **Exceção:** se precisar incluir retroativamente, seria necessário um override manual no ranking anual (futura feature)

---

## Resumo das implementações

| Override | Complexidade | Arquivos afetados | Prioridade |
|---|---|---|---|
| Penalidade de saída | Média | stage-setup-screen, types, demo-league-state, stage-runtime-shared | Alta |
| Contribuição anual | Média | demo-league-state, types, demo-admin-store, stage-setup-screen | Alta |
| Premiação do dia | Baixa | demo-league-state, types | Alta |
| Fechamento da partida | Alta | stage-setup-screen, types | Média |
| Etapa teste no ranking | Baixa | demo-league-state, types, demo-admin-store | Média |

---

## Ordem de implementação sugerida

1. **Premiação do dia** (mais simples — 1 campo editável na finalização)
2. **Contribuição anual** (similar à premiação, mas com lógica de débito)
3. **Etapa teste no ranking** (toggle simples na finalização)
4. **Penalidade de saída** (painel de confirmação + mudança na lógica de pontos)
5. **Fechamento da partida** (mais complexo — modal de acordo, mudança no fluxo)
