# SHPL — Análise do Fluxo de Jogador Atrasado

> Documento de análise completa do que acontece quando um jogador chega atrasado a uma partida/etapa, identificando erros, comportamentos inesperados e pontos de melhoria.
> Criado em 31/07/2026.

---

## Índice

1. [Cenário de teste usado](#1-cenário-de-teste-usado)
2. [Fluxo passo a passo](#2-fluxo-passo-a-passo)
3. [Bugs identificados](#3-bugs-identificados)
4. [Problemas de UX](#4-problemas-de-ux)
5. [Problemas de dados](#5-problemas-de-dados)
6. [Resumo e priorização](#6-resumo-e-priorização)

---

## 1. Cenário de teste usado

Para esta análise, vou rastrear um cenário concreto:

- **5 jogadores**: A, B, C, D, E
- **E chega atrasado** na Partida 3 (já foram jogadas 2 partidas)
- Buy-in: R$ 10 anual + R$ 10 diário
-买-in: R$ 10 annual + R$ 10 daily

**Estado inicial:**
Todos os jogadores começam com `matchPoints: [0]` e flags `false`.

---

## 2. Fluxo passo a passo

### Etapa 1: Inicialização

```
A: matchPoints=[0], annualPaid=false, dailyPaid=false, outOfCurrentMatch=false
B: matchPoints=[0], annualPaid=false, dailyPaid=false, outOfCurrentMatch=false
C: matchPoints=[0], annualPaid=false, dailyPaid=false, outOfCurrentMatch=false
D: matchPoints=[0], annualPaid=false, dailyPaid=false, outOfCurrentMatch=false
E: matchPoints=[0], annualPaid=false, dailyPaid=false, outOfCurrentMatch=false
```

### Etapa 2: Buy-in de A, B, C, D

Após confirmar buy-in anual + diário:

```
A: annualPaid=true, dailyPaid=true, outOfCurrentMatch=false
B: annualPaid=true, dailyPaid=true, outOfCurrentMatch=false
C: annualPaid=true, dailyPaid=true, outOfCurrentMatch=false
D: annualPaid=true, dailyPaid=true, outOfCurrentMatch=false
E: annualPaid=false, dailyPaid=false, outOfCurrentMatch=false  ← não pagou nada
```

### Etapa 3: Partida 1 inicia (`performStartCurrentMatch`)

```javascript
// stage-setup-screen.tsx, linha 1015-1019:
outOfCurrentMatch: player.leftStage || !player.annualPaid || !player.dailyPaid
```

```
A: outOfCurrentMatch=false (tem buy-in)
B: outOfCurrentMatch=false
C: outOfCurrentMatch=false
D: outOfCurrentMatch=false
E: outOfCurrentMatch=true  ← SEM buy-in, fica de fora
```

**Partida 1 resultado:** A=1º(10pts), B=2º(8pts), C=3º(6pts), D=4º(4pts)

```
A: matchPoints=[10]
B: matchPoints=[8]
C: matchPoints=[6]
D: matchPoints=[4]
E: matchPoints=[0]   ← não jogou, ficou com 0
```

### Etapa 4: Partida 1 fecha

### Etapa 5: Partida 2 inicia (`performStartNextMatch`)

```javascript
// stage-setup-screen.tsx, linha 1036-1041:
matchPoints: [...player.matchPoints, 0]  // adiciona um 0 para todos
outOfCurrentMatch: player.leftStage || !player.annualPaid || !player.dailyPaid
```

```
A: matchPoints=[10, 0], outOfCurrentMatch=false
B: matchPoints=[8, 0], outOfCurrentMatch=false
C: matchPoints=[6, 0], outOfCurrentMatch=false
D: matchPoints=[4, 0], outOfCurrentMatch=false
E: matchPoints=[0, 0], outOfCurrentMatch=true  ← continua de fora
```

**Partida 2 resultado:** B=1º(10pts), A=2º(8pts), D=3º(6pts), C=4º(4pts)

```
A: matchPoints=[10, 8]
B: matchPoints=[8, 10]
C: matchPoints=[6, 4]
D: matchPoints=[4, 6]
E: matchPoints=[0, 0]
```

### Etapa 6: Partida 2 fecha

### Etapa 7: E chega e confirma buy-in (`handleConfirmBothBuyIns`)

```javascript
// stage-setup-screen.tsx, linha 1165-1188:
updateSelectedPlayer((player) => ({
  ...player,
  annualPaid: true,
  dailyPaid: true,
  outOfCurrentMatch:
    currentMatchStartedAt && !currentMatchClosed
      ? false
      : player.outOfCurrentMatch,  // ← PROBLEMA AQUI
}));
```

**Neste momento:**
- `currentMatchStartedAt` = `null` (foi setado como null no `performStartNextMatch`, linha 1043)
- `currentMatchClosed` = `false`
- Condição: `null && !false` = `null && true` = `null` = **falsy**

**Resultado:**
```
E: annualPaid=true, dailyPaid=true, outOfCurrentMatch=true  ← BUG!
```

E pagou mas **continua marcado como fora da partida** porque nenhuma partida está em andamento.

### Etapa 8: Partida 3 inicia (`performStartNextMatch`)

```javascript
outOfCurrentMatch: player.leftStage || !player.annualPaid || !player.dailyPaid
```

Agora E tem `annualPaid=true` e `dailyPaid=true`:
```
E: outOfCurrentMatch=false  ← corrigido automaticamente
matchPoints=[0, 0, 0]       ← ZERO para as 2 primeiras partidas
```

**Partida 3 resultado:** E=1º(10pts), B=2º(8pts), A=3º(6pts), D=4º(4pts)

```
A: matchPoints=[10, 8, 6]   = 24pts, 1 win
B: matchPoints=[8, 10, 8]   = 26pts, 1 win
C: matchPoints=[6, 4, 0]    = 10pts, 0 wins
D: matchPoints=[4, 6, 4]    = 14pts, 0 wins
E: matchPoints=[0, 0, 10]   = 10pts, 1 win
```

### Etapa 9: Ranking final da etapa (wins → points)

```
1º B: 1 win, 26pts
2º A: 1 win, 24pts
3º E: 1 win, 10pts  ← chegou na Partida 3, ficou em 3º
4º D: 0 wins, 14pts
5º C: 0 wins, 10pts
```

**E recebe 6 pontos anuais (3º lugar)** apesar de ter jogado apenas 3 de 5 partidas.

---

## 3. Bugs identificados

### BUG 1: `outOfCurrentMatch` não atualiza quando compra entre partidas

**Severidade:** 🟡 Média

**Onde:** `stage-setup-screen.tsx`, linhas 1148-1155 e 1168-1176

**Problema:**
Quando um jogador confirma buy-in **entre partidas** (após uma partida fechar e antes da próxima iniciar), a flag `outOfCurrentMatch` não é atualizada para `false`.

```javascript
// handleConfirmDailyBuyIn:
outOfCurrentMatch:
  currentMatchStartedAt && !currentMatchClosed
    ? false
    : player.outOfCurrentMatch,  // ← fica como está
```

A condição `currentMatchStartedAt && !currentMatchClosed` só funciona quando uma partida **está em andamento**. Entre partidas, `currentMatchStartedAt` é `null`, então a condição é falsa.

**Impacto:**
- O jogador paga mas aparece como "fora" até a próxima partida iniciar
- O dealer pode não perceber que o jogador já pagou e tentar sentá-lo
- Cosmeticamente confuso, mas funcionalmente corrigido quando a partida inicia

**Correção sugerida:**
```javascript
outOfCurrentMatch:
  // Se pagou buy-in, permite entrar na partida
  (player.annualPaid && player.dailyPaid)
    ? false
    : player.outOfCurrentMatch,
```

Ou, mais precisamente:
```javascript
outOfCurrentMatch:
  // Se uma partida está em andamento, entra imediatamente
  (currentMatchStartedAt && !currentMatchClosed)
    ? false
    // Se não, mas já pagou, prepara para a próxima partida
    : (player.annualPaid && player.dailyPaid && !player.leftStage)
      ? false
      : player.outOfCurrentMatch,
```

---

### BUG 2: matchPoints inclui zeros para partidas que o jogador não participou

**Severidade:** 🟡 Média

**Onde:** `performStartNextMatch` (linha 1040), `buildFinalRanking` (linha 803), `stageMatchRecord` (linha 253-262)

**Problema:**
Quando uma nova partida inicia, **todos** os jogadores recebem um `0` no array `matchPoints`, inclusive jogadores que não estão participando:

```javascript
// performStartNextMatch:
matchPoints: [...player.matchPoints, 0]  // adiciona 0 para TODOS
```

Isso significa que um jogador que chegou na Partida 3 terá:
```
matchPoints=[0, 0, 0]  ← 3 zeros, mas só participou de 0 partidas ainda
```

Após jogar a Partida 3 e ganhar:
```
matchPoints=[0, 0, 10]  ← 2 zeros são de partidas que NÃO jogou
```

**Impacto:**
- No `stageMatchRecord`, aparece como "0 pontos na Partida 1" e "0 pontos na Partida 2"
- Na exibição do histórico, o jogador parece ter "perdido" as partidas anteriores
- O total de pontos está correto (10), mas a percepção é errada
- Na finalização, o `buildFinalRanking` calcula `totalPoints` corretamente (soma = 10)
- Mas o `wins` count está correto (1 vitória)

**Correção sugerida:**
Não adicionar `0` para jogadores que não estão participando. Em vez disso, manter o array com o tamanho correto:

```javascript
// performStartNextMatch:
matchPoints: player.outOfCurrentMatch || player.leftStage
  ? [...player.matchPoints]  // não adiciona 0
  : [...player.matchPoints, 0],  // só adiciona se participa
```

**⚠️ ATENÇÃO:** Isso mudaria o `currentMatchIndex` que é calculado como:
```javascript
const currentMatchIndex = Math.max(players[0]?.matchPoints.length ?? 1, 1) - 1;
```

Se jogadores têm tamanhos diferentes de array, o `currentMatchIndex` ficaria inconsistente. Seria necessário repensar como o index da partida atual é rastreado.

**Correção alternativa (mais segura):**
Manter o array com zeros para todos, mas **marcar** quais partidas o jogador participou:

```typescript
type StagePlayerControl = {
  // ... campos existentes
  matchParticipantFlags: boolean[];  // true se participou da partida i
};
```

Na finalização, usar os flags para exibir corretamente no histórico.

---

### BUG 3: Stack estimado do jogador atrasado está errado

**Severidade:** 🟠 Alta

**Onde:** Inicialização em `stage-setup-screen.tsx`, linha 108

**Problema:**
Todo jogador começa com `estimatedStack: 3000` (stack inicial padrão). Quando um jogador chega atrasado na Partida 3, o stack estimado continua 3000, mas o stack real médio pode ser muito menor (porque jogadores foram eliminados e os stacks foram redistribuídos).

**Exemplo:**
- Partida 1: 5 jogadores × 3000 = 15.000 chips totais
- Partida 2: 4 jogadores × ~3750 = 15.000 chips totais (redistribuição automática)
- Partida 3: E chega com estimatedStack=3000
  - Total estimado: 4×3750 + 3000 = 18.000 (inflado em 3.000)
  - Média real: 15.000 / 4 = 3.750
  - Média calculada: 18.000 / 5 = 3.600 (errada porque inclui E com stack alto)

**Impacto:**
- O cálculo de `averageActiveStack` fica distorcido
- O `averageActiveBigBlinds` fica errado
- A redistribuição de stacks quando alguém sai da etapa pode ser incorreta
- A exibição de "Stacks" na mesa mostra dados incorretos

**Correção sugerida:**
Quando um jogador confirma buy-in durante uma partida em andamento, sugerir automaticamente o stack médio atual:

```javascript
// Dentro de handleConfirmDailyBuyIn ou handleConfirmBothBuyIns:
if (currentMatchStartedAt && !currentMatchClosed) {
  // Partida em andamento — sugere stack médio atual
  setPlayers((currentPlayers) => {
    const activePlayers = currentPlayers.filter(
      (p) => p.annualPaid && p.dailyPaid && !p.leftStage && !p.outOfCurrentMatch
    );
    const totalChips = activePlayers.reduce((sum, p) => sum + (p.estimatedStack || 0), 0);
    const suggestedStack = Math.round(totalChips / Math.max(activePlayers.length, 1));
    
    return currentPlayers.map((p) =>
      p.playerId === selectedPlayerId
        ? { ...p, estimatedStack: suggestedStack }
        : p
    );
  });
}
```

Ou, melhor ainda, perguntar ao dealer:
```
┌─────────────────────────────────────────────────┐
│  [Nome] chegou na Partida 3                     │
│                                                 │
│  Stack estimado: [3000]  ← editável             │
│  Stack médio atual: ~3750                       │
│                                                 │
│  [Usar média]  [Manter 3000]  [Personalizar]    │
└─────────────────────────────────────────────────┘
```

---

### BUG 4: Jogador atrasado pode receber pontos de partidas que não jogou (via ajuste manual)

**Severidade:** 🟠 Alta

**Onde:** `handleApplyManualMatchAdjustment` (linha 1411-1478)

**Problema:**
O sistema de ajuste manual de colocação permite ao dealer atribuir posições para **qualquer partida**, inclusive partidas que o jogador não participou.

```javascript
// handleApplyManualMatchAdjustment:
const nextMatchPoints = [...player.matchPoints];
const placement = placementByPlayerId.get(player.playerId);
nextMatchPoints[manualAdjustmentMatchIndex] = placement
  ? calculateMatchPoints(placement)
  : nextMatchPoints[manualAdjustmentMatchIndex];
```

O `manualAdjustmentMatchIndex` pode ser 0 ou 1 (partidas que E não jogou), e o sistema aceita tranquilamente.

**Exemplo:**
- E tem `matchPoints=[0, 0, 10]`
- Dealer abre o ajuste manual para a Partida 1
- Dealer atribui 2º lugar para E
- E fica com `matchPoints=[8, 0, 10]` = 18pts
- **Isso é errado** — E não participou da Partida 1

**Impacto:**
- Permite fraudar o ranking
- Dados históricos ficam incorretos
- Não há validação de participação

**Correção sugerida:**
Validar se o jogador participou da partida antes de permitir ajuste:

```javascript
// No handleApplyManualMatchAdjustment:
const stagePlayer = players.find((p) => p.playerId === selection.playerId);

// Se o jogador não participou da partida, não permite ajuste
// Verificar se o jogador tinha buy-in E estava ativo naquela partida
if (stagePlayer && !stagePlayer.annualPaid) {
  setStageNotice(`${selection.playerName} não comprou buy-in e não pode ter resultado nesta partida.`);
  return;
}
```

Ou, melhor ainda, **não mostrar** jogadores que não participaram no painel de ajuste manual:

```javascript
// Filtrar jogadores que participaram da partida
const eligibleForAdjustment = players.filter((player) => {
  // Participou se pagou buy-in E não saiu antes da partida
  return player.annualPaid && player.dailyPaid && !player.leftStage;
});
```

---

### BUG 5: `currentMatchIndex` é calculado pelo tamanho do array, não pelo número real de partidas

**Severidade:** 🟡 Média

**Onde:** `stage-setup-screen.tsx`, linha 701

**Problema:**
```javascript
const currentMatchIndex = Math.max(players[0]?.matchPoints.length ?? 1, 1) - 1;
```

O `currentMatchIndex` é derivado do tamanho do array `matchPoints` do **primeiro jogador**. Se jogadores têm arrays de tamanhos diferentes (porque um chegou tarde), o index ficaria errado.

**Exemplo:**
- A: `matchPoints=[10, 8, 6]` → length=3 → currentMatchIndex=2
- E: `matchPoints=[0, 0, 10]` → length=3 → currentMatchIndex=2
- OK, neste caso funciona porque `performStartNextMatch` adiciona 0 para todos

**Mas** se o BUG 2 for corrigido (não adicionar 0 para jogadores de fora):
- A: `matchPoints=[10, 8, 6]` → length=3
- E: `matchPoints=[10]` → length=1
- `players[0]` é A → currentMatchIndex=2
- E só tem 1 entry, mas o index é 2 → `matchPoints[2]` = undefined

**Impacto:**
- Se o BUG 2 for corrigido, esse bug emerge
- Por enquanto, não causa problema porque todos têm o mesmo tamanho

**Correção sugerida:**
Rastrear o `currentMatchIndex` como um estado separado, não derivar do array:

```javascript
const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
```

Ou usar o `completedMatchDurations.length` como referência:
```javascript
const currentMatchIndex = completedMatchDurations.length;
```

---

## 4. Problemas de UX

### UX 1: Sem indicação visual de que o jogador é atrasado

**Problema:**
Quando um jogador chega atrasado e confirma buy-in, não há nenhuma indicação visual de que ele é um "novato" na etapa. Ele aparece igual aos outros jogadores.

**Sugestão:**
Adicionar um badge ou indicador visual:
```
┌─────────────────────────────────────────────────┐
│  🟢 João — Jogando agora                        │
│  🟢 Pedro — Jogando agora                       │
│  🟡 Maria — Apto para jogar                     │
│  🔵 Carlos — Chegou na Partida 3  ← NOVO       │
└─────────────────────────────────────────────────┘
```

### UX 2: Sem aviso ao dealer sobre stack incorreto

**Problema:**
Quando E chega com `estimatedStack: 3000`, o dealer não é alertado de que o stack pode estar incorreto.

**Sugestão:**
Mostrar um aviso:
```
⚠ O stack estimado de [Nome] (3000) pode estar acima do médio da mesa (~3750).
   Considere ajustar antes de iniciar a partida.
```

### UX 3: Sem resumo de participação no final da etapa

**Problema:**
Na tela de finalização, não há indicação de quem chegou atrasado e em qual partida. O dealer não tem visibilidade sobre isso.

**Sugestão:**
Adicionar na tela de finalização:
```
┌─────────────────────────────────────────────────┐
│  Resumo da etapa                                │
│                                                 │
│  Jogadores: 5 (4 desde início, 1 atrasado)     │
│  Partidas: 5                                    │
│                                                 │
│  Participação:                                  │
│  • A: Partidas 1-5 (5/5)                       │
│  • B: Partidas 1-5 (5/5)                       │
│  • C: Partidas 1-5 (5/5)                       │
│  • D: Partidas 1-5 (5/5)                       │
│  • E: Partidas 3-5 (3/5) ← atrasado           │
└─────────────────────────────────────────────────┘
```

### UX 4: Sem confirmação de "tem certeza que quer sentar o jogador atrasado?"

**Problema:**
O dealer pode sentar o jogador atrasado em qualquer lugar da mesa sem confirmação. Se o jogador não tem stack correto, isso pode causar problemas.

**Sugestão:**
Ao atribuir assento para um jogador que acabou de chegar, mostrar:
```
[Nome] chegou na Partida 3 e tem estimatedStack=3000.
O stack médio atual é ~3750. Deseja sentar mesmo assim?
[Sentá-lo]  [Ajustar stack primeiro]
```

---

## 5. Problemas de dados

### DADOS 1: Histórico mostra "0 pontos" em partidas que o jogador não jogou

**Problema:**
No `stageMatchRecord`, o jogador atrasado aparece com 0 pontos em partidas que não participou:

```
Partida 1: A=10, B=8, C=6, D=4, E=0  ← E não jogou
Partida 2: B=10, A=8, D=6, C=4, E=0  ← E não jogou
Partida 3: E=10, B=8, A=6, D=4, C=0
```

**Impacto:**
- Parece que E "perdeu" as partidas 1 e 2
- Na verdade, E não estava presente

**Sugestão:**
Em vez de 0, usar `null` ou `undefined` para indicar "não participou":
```
Partida 1: A=10, B=8, C=6, D=4, E=—
Partida 2: B=10, A=8, D=6, C=4, E=—
Partida 3: E=10, B=8, A=6, D=4, C=0
```

### DADOS 2: `annualPaid` e `dailyPaid` não registram QUANDO foram pagos

**Problema:**
O sistema registra que o jogador pagou, mas não registra **quando** pagou. Isso torna impossível saber se o jogador pagou antes ou depois do início da partida.

**Sugestão:**
Adicionar timestamps:
```typescript
type StagePlayerControl = {
  // ... campos existentes
  annualPaidAt?: string;  // ISO timestamp
  dailyPaidAt?: string;   // ISO timestamp
  joinedMatchAt?: string; // ISO timestamp da primeira partida em que participou
};
```

### DADOS 3: Não há "fonte da verdade" sobre em qual partida o jogador entrou

**Problema:**
O sistema não rastreia explicitamente em qual partida o jogador entrou. É possível inferir pelo primeiro valor não-zero em `matchPoints`, mas isso é frágil (e quebraria se o BUG 2 fosse corrigido).

**Sugestão:**
Adicionar campo explícito:
```typescript
type StagePlayerControl = {
  // ... campos existentes
  firstMatchIndex?: number;  // índice da primeira partida em que participou
};
```

---

## 6. Resumo e priorização

### Bugs (correções necessárias)

| # | Bug | Severidade | Esforço | Prioridade |
|---|---|---|---|---|
| 1 | `outOfCurrentMatch` não atualiza entre partidas | 🟡 Média | Baixo | **Alta** |
| 2 | matchPoints inclui zeros para não-participantes | 🟡 Média | Médio | **Média** |
| 3 | Stack estimado errado para jogador atrasado | 🟠 Alta | Baixo | **Alta** |
| 4 | Ajuste manual permite pontos para não-participantes | 🟠 Alta | Baixo | **Alta** |
| 5 | `currentMatchIndex` derivado do array | 🟡 Média | Médio | **Baixa** |

### Problemas de UX (melhorias)

| # | Problema | Prioridade |
|---|---|---|
| 1 | Sem indicação visual de jogador atrasado | **Média** |
| 2 | Sem aviso de stack incorreto | **Alta** |
| 3 | Sem resumo de participação na finalização | **Média** |
| 4 | Sem confirmação ao sentar jogador atrasado | **Baixa** |

### Problemas de dados (melhorias)

| # | Problema | Prioridade |
|---|---|---|
| 1 | Histórico mostra "0" em vez de "—" | **Média** |
| 2 | Sem timestamps de pagamento | **Baixa** |
| 3 | Sem registro de primeira partida | **Baixa** |

---

## Ordem de implementação sugerida

1. **BUG 1** — Corrigir `outOfCurrentMatch` entre partidas (rápido, alto impacto)
2. **BUG 3** — Stack estimado para jogador atrasado (rápido, alto impacto)
3. **BUG 4** — Validar participação no ajuste manual (rápido, alto impacto)
4. **UX 2** — Aviso de stack incorreto ao sentar
5. **UX 1** — Indicador visual de jogador atrasado
6. **UX 3** — Resumo de participação na finalização
7. **BUG 2** — Repensar zeros no matchPoints (complexo, requer mudança de design)
8. **DADOS 2-3** — Timestamps e registro de primeira partida (futuro)

---

## Perguntas para o Caio

Antes de implementar, preciso de decisões sobre:

1. **BUG 2 (zeros no matchPoints):** Quer que eu mude para não adicionar zeros para jogadores de fora? Isso requer mudanças mais profundas no design. Ou prefere manter os zeros e só corrigir a exibição?

2. **UX 1 (indicador visual):** Quer um badge "Atrasado" no jogador, ou prefere algo mais sutil?

3. **DADOS (timestamps):** Quer que eu adicione timestamps de pagamento agora, ou é algo para o futuro?

4. **BUG 4 (validação no ajuste manual):** Quer que eu bloqueie completamente o ajuste para não-participantes, ou que mostre um aviso mas permita?

5. **Participação:** Quer que eu adicione um campo `firstMatchIndex` explícito, ou prefere inferir do `matchPoints`?
