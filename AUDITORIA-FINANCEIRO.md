# Auditoria Financeira — SHPL

Documento de auditoria e ajustes da parte financeira do sistema SHPL. Cada sessão detalha um item encontrado, a explicação do problema, a solução proposta e o passo a passo de implementação.

**Data da auditoria:** 30/07/2026
**Escopo:** Módulo financeiro completo (buy-in, premiação diária, pote anual, ranking, configurações, persistência).

**Estrutura do documento:**
- Itens 1 a 7: bugs encontrados na auditoria
- Item 8: ajuste manual do pote anual (correção de valor real)
- Item 9: nova funcionalidade de controle de dívidas

---

## Sumário

| # | Severidade | Item |
|---|-----------|-----|
| 1 | Médio | Pontos anuais com escala divergente entre arquivos (mudança de regra) |
| 2 | Médio | Ranking anual ordenado por critério divergente (mudança de regra) |
| 3 | Médio | Dashboard sempre mostra R$ 0,00 na arrecadação do dia |
| 4 | Médio | Nome de jogador vazio no ranking de partidas do histórico |
| 5 | Médio | Merge de `annualPotCents` ignora valor zero |
| 6 | Médio | Mock de dados com valores financeiros hardcoded |
| 7 | Baixo | Etapas de teste não são filtradas no `demo-league-store.ts` |
| 8 | Alto | Ajuste do pote anual para valor real (R$ 175,00) |
| 9 | Funcionalidade | Controle de dívidas: ver quem está devendo e quanto |

---

## Bug 1 — Pontos anuais com escala divergente entre arquivos (mudança de regra)

### Severidade
Médio — divergência entre arquivos, mas é intencional pelo novo critério. Requer atualizar o regulamento.

### Arquivos afetados
- `src/lib/data/demo-league-state.ts` (linhas 683–705, função `calculateAnnualPoints`)
- `src/lib/domain/rules.ts` (linhas 22–29, função `calculateAnnualStagePoints`)
- `src/lib/data/shpl-regulation-store.ts` (texto do regulamento)

### Problema
O regulamento do SHPL define a pontuação anual assim:

> Campeão da etapa: 10 pontos
> Segundo lugar: 7 pontos
> Terceiro lugar: 5 pontos
> Participante que joga até o final: 3 pontos
> Jogador que sai antes do fim: 1 ponto

A escala usada em `demo-league-state.ts` e `rules.ts` é a escala de **pontuação de partida** (10/8/6/4/2), não a escala anual (10/7/5/3/1). O arquivo `demo-league-store.ts` (não usado em produção) tem os valores do regulamento.

Acontece que a equipe mudou de ideia: a nova regra de pontuação anual é usar a escala de partida (10/8/6/4/2), não a do regulamento. Então o que está em `demo-league-state.ts` e `rules.ts` é o comportamento **desejado**, e a divergência com `demo-league-store.ts` é que está errada.

O regulamento em `shpl-regulation-store.ts` ainda traz o texto antigo (10/7/5/3/1) e precisa ser atualizado para refletir a nova escala.

### Por que isso é importante
Tem duas correções: alinhar o `demo-league-store.ts` à nova escala (para não ter divergência entre arquivos) e atualizar o regulamento para que o texto descreva corretamente o que o sistema faz.

### Solução
Atualizar `demo-league-store.ts` para usar a escala 10/8/6/4/2 e atualizar o regulamento para refletir o mesmo.

### Implementação

**Arquivo: `src/lib/data/demo-league-store.ts`**

Localize a função `calculateAnnualPoints` (linha 431). Substitua o corpo para:

```ts
function calculateAnnualPoints(position: number, leftStage: boolean) {
  if (leftStage) {
    return 1;
  }

  if (position === 1) {
    return 10;
  }

  if (position === 2) {
    return 8;
  }

  if (position === 3) {
    return 6;
  }

  if (position === 4) {
    return 4;
  }

  return 2;
}
```

**Arquivo: `src/lib/data/shpl-regulation-store.ts`**

Localize a seção "Pontuacao do ranking anual" (por volta da linha 167, id `pontuacao-ranking-anual`) e atualize o primeiro parágrafo para refletir a nova escala:

```
"Ao final de cada encontro, os jogadores recebem a seguinte pontuacao: campeao da etapa 10 pontos, segundo lugar 8 pontos, terceiro lugar 6 pontos, quarto lugar 4 pontos, demais jogadores que jogam ate o final 2 pontos, jogador que sai antes do fim 1 ponto e ausente 0 ponto."
```

Mantenha o restante do texto da seção igual.

### Verificação
Abra o regulamento na aplicação e confirme que o texto da seção 11 está com a nova escala (10/8/6/4/2). Em seguida, abra `demo-league-store.ts` e confirme que a função `calculateAnnualPoints` retorna os mesmos valores.

---

## Bug 2 — Ranking anual ordenado por critério divergente (mudança de regra)

### Severidade
Médio — divergência entre arquivos, mas a nova regra prioriza vitórias. Requer atualizar o regulamento.

### Arquivos afetados
- `src/lib/data/demo-league-state.ts` (linhas 673–681, função `compareRankingEntries`)
- `src/lib/data/shpl-regulation-store.ts` (texto do regulamento)

### Problema
O regulamento do SHPL diz:

> O ranking anual é definido pela soma total de pontos. Em caso de empate, o desempate acontece por: maior número de vitórias de etapa no ano, maior número de participações no ano, melhor resultado no último encontro do ano e, por fim, empate técnico.

Ou seja, segundo o regulamento atual, o critério primário deveria ser **pontos totais**, e o secundário **vitórias**.

Acontece que a equipe mudou de ideia: a nova regra de classificação é priorizar o **número de vitórias**, sendo os pontos totais apenas um critério de desempate. Isso vale tanto para o ranking anual quanto para o ranking do dia.

A função `compareRankingEntries` no `demo-league-state.ts` já está com a nova lógica (vitórias primeiro, pontos depois). Mas o `demo-league-store.ts` (linha 417) e o regulamento ainda trazem a lógica antiga (pontos primeiro, vitórias depois).

### Por que isso é importante
A nova regra já está aplicada no caminho principal (`demo-league-state.ts`), mas o `demo-league-store.ts` ainda ordena pelo critério antigo, e o regulamento em texto também. Ambos precisam ser atualizados para refletir a nova regra.

### Solução
Atualizar `demo-league-store.ts` para ordenar por vitórias primeiro, e atualizar o texto do regulamento.

### Implementação

**Arquivo: `src/lib/data/demo-league-store.ts`**

Localize a função `compareRankingEntries` (linha 417). Substitua por:

```ts
function compareRankingEntries(left: RankingEntry, right: RankingEntry) {
  return (
    right.wins - left.wins ||
    right.points - left.points ||
    right.secondPlaces - left.secondPlaces ||
    right.thirdPlaces - left.thirdPlaces ||
    left.playerName.localeCompare(right.playerName, "pt-BR")
  );
}
```

A única mudança é colocar `right.wins - left.wins` antes de `right.points - left.points`.

**Arquivo: `src/lib/data/shpl-regulation-store.ts`**

Localize a seção "Ranking anual e desempate" (id `ranking-anual-desempate`, por volta da linha 188). Atualize o primeiro parágrafo para refletir a nova regra:

```
"O ranking anual e definido pelo numero de vitorias de etapa acumuladas no ano. Em caso de empate, os pontos totais sao utilizados como primeiro criterio de desempate, seguidos por: maior numero de participacoes no ano, melhor resultado no ultimo encontro do ano e, por fim, empate tecnico."
```

Mantenha o restante igual.

### Verificação
Abra o regulamento e confirme que o texto da seção 13 menciona vitórias como critério primário. Em seguida, abra `demo-league-store.ts` e confirme que `compareRankingEntries` ordena por vitórias antes de pontos.

---

## Bug 3 — Dashboard sempre mostra R$ 0,00 na arrecadação do dia

### Severidade
Médio — a tela inicial do sistema mostra dados zerados mesmo quando há jogadores pagantes.

### Arquivos afetados
- `src/lib/data/demo-league-store.ts` (linhas 185–190)
- `src/lib/data/demo-league-state.ts` (linhas 185–190)

### Problema
A função `getDemoLeagueSnapshot` em ambos os arquivos retorna valores fixos para o resumo financeiro:

```ts
financialSummary: {
  dailyPrizePool: formatCurrency(0),
  annualPot: formatCurrency(store.annualPotCents / 100),
  dailyPaidPlayers: 0,
  annualPaidPlayers: 0,
}
```

Isso significa que a dashboard sempre exibe:
- Arrecadação do dia: R$ 0,00
- Buy-ins do dia: 0 pagantes
- Pagamentos anuais: 0 quites

O componente `FinancialSummary` lê esses valores e mostra zero mesmo durante uma etapa com jogadores pagantes.

O pote anual (`annualPot`) está correto porque é lido do store, mas os outros três campos não consideram o estado atual da etapa.

### Solução
Calcular os valores de `dailyPrizePool`, `dailyPaidPlayers` e `annualPaidPlayers` a partir do estado real da etapa em andamento (jogadores marcados como `paidAnnual` e `paidDaily`).

Esses dados estão disponíveis em `stagePlayers` dentro do próprio snapshot. Basta contar quantos têm `paidAnnual: true` e `paidDaily: true`, e multiplicar pelo buy-in atual (que precisa ser lido das configurações salvas).

### Implementação

**Arquivos: `src/lib/data/demo-league-store.ts` e `src/lib/data/demo-league-state.ts`**

Substitua o bloco fixo por um cálculo dinâmico. Você vai precisar:

1. Ler o buy-in atual das configurações. O buy-in está salvo em `localStorage` com a chave `shpl-2026-settings` no cliente, mas no servidor ele precisa ser lido de outro lugar. Como o snapshot é gerado no servidor, adicione um valor padrão ou leia das configurações da etapa.

2. Calcular os totais:

```ts
financialSummary: {
  dailyPrizePool: formatCurrency(
    stagePlayers.filter((p) => p.paidDaily).length * buyInDaily
  ),
  annualPot: formatCurrency(store.annualPotCents / 100),
  dailyPaidPlayers: stagePlayers.filter((p) => p.paidDaily).length,
  annualPaidPlayers: stagePlayers.filter((p) => p.paidAnnual).length,
}
```

3. Se o buy-in não estiver disponível no servidor, use `0` como fallback. O valor será exibido corretamente assim que o admin marcar pagamentos na tela de setup.

**Alternativa simplificada:** Ler o buy-in das configurações do admin no servidor. Se isso for complexo demais para esta correção, o primeiro passo pode ser apenas contar os jogadores pagantes e exibir a contagem, deixando o valor em R$ 0 até que o buy-in seja configurado.

### Verificação
Abra a dashboard, vá até a tela de setup, marque um jogador como "buy-in do dia pago" e veja se o card "Arrecadação do dia" na dashboard atualiza para um valor maior que zero.

---

## Bug 4 — Nome de jogador vazio no ranking de partidas

### Severidade
Médio — afeta a visualização do histórico de etapas.

### Arquivos afetados
- `src/lib/data/demo-league-store.ts` (linhas 538–557, função `buildMatchRanking`)

### Problema
A função `buildMatchRanking` no `demo-league-store.ts` não recebe o mapa de nomes de jogadores e define `playerName: ""` para cada entrada do ranking:

```ts
function buildMatchRanking(pointsByPlayer: Record<string, number>): StageHistoryMatchRankingEntry[] {
  return Object.entries(pointsByPlayer)
    .map(([playerId, points]) => ({
      playerId,
      playerName: "",  // ← sempre vazio
      points,
      position: 0,
    }))
    ...
}
```

Isso faz com que, no histórico de uma etapa finalizada, o ranking de cada partida mostre linhas sem nome de jogador.

A versão correta em `demo-league-state.ts` (linha 838) recebe `playerNameById` como parâmetro e usa o nome do mapa.

### Solução
Adicionar um parâmetro `playerNameById` à função `buildMatchRanking` e usá-lo para preencher o nome do jogador.

### Implementação

**Arquivo: `src/lib/data/demo-league-store.ts`**

1. Localize a função `buildMatchRanking` (linha 538) e altere a assinatura para receber o mapa de nomes:

```ts
function buildMatchRanking(
  pointsByPlayer: Record<string, number>,
  playerNameById: Map<string, string>
): StageHistoryMatchRankingEntry[] {
  return Object.entries(pointsByPlayer)
    .map(([playerId, points]) => ({
      playerId,
      playerName: playerNameById.get(playerId) ?? "Jogador",
      points,
      position: 0,
    }))
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }
      return left.playerName.localeCompare(right.playerName, "pt-BR");
    })
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
}
```

2. Localize a chamada para `buildMatchRanking` dentro de `buildStageHistoryDetail` (linha 517) e passe o `playerNameById`. Mas note que a função `buildStageHistoryDetail` também não recebe `playerNameById` como parâmetro. Adicione esse parâmetro à assinatura de `buildStageHistoryDetail` e propague até `finalizeStoredStage`.

3. Em `finalizeStoredStage`, o `playerNameById` já existe (linha 211). Adicione-o ao objeto passado para `buildStageHistoryDetail`.

### Verificação
Finalize uma etapa, abra o histórico e clique para ver os detalhes. O ranking de cada partida deve mostrar o nome dos jogadores em vez de linhas em branco.

---

## Bug 5 — Merge de `annualPotCents` ignora valor zero

### Severidade
Médio — pode resetar o pote anual do usuário sem intenção.

### Arquivos afetados
- `src/lib/data/demo-league-state.ts` (linha 998, dentro da função `mergeLeagueStates`)

### Problema
A função `mergeLeagueStates` usa o operador `||` (OR lógico) para mesclar o `annualPotCents`:

```ts
annualPotCents: bundled.annualPotCents || current.annualPotCents,
```

O problema do `||` é que ele trata `0` como falsy. Se o usuário zerou o pote anual intencionalmente, o `bundled.annualPotCents` (que pode ser 0) é considerado falso, e o sistema usa o valor antigo (`current.annualPotCents`), sobrescrevendo o zero do usuário.

Na prática, isso significa que se o admin apertar um botão hipotético de "zerar pote" ou se o pote for zerado por alguma lógica de reset, o merge com o bundle vai trazer o valor antigo de volta.

### Solução
Usar o operador de coalescência nula (`??`) que só considera `null` e `undefined` como ausentes, não `0`. Ou inverter a lógica para que o valor do usuário (`current`) sempre tenha prioridade sobre o seed (`bundled`).

### Implementação

**Arquivo: `src/lib/data/demo-league-state.ts`**

Localize a linha 998 dentro da função `mergeLeagueStates`. Substitua por:

```ts
annualPotCents: current.annualPotCents || bundled.annualPotCents,
```

Aqui a inversão é proposital: o valor atual do usuário tem prioridade, e só cai para o bundle se for `null`/`undefined`/`0`. Isso garante que o pote que o usuário acumulou na temporada não seja sobrescrito pelo seed inicial.

Se quiser manter a ordem original (bundle primeiro), use o operador `??`:

```ts
annualPotCents: bundled.annualPotCents ?? current.annualPotCents,
```

Mas a versão recomendada é inverter, porque o valor do usuário é o que importa.

### Verificação
Esse bug é difícil de reproduzir visualmente. Para testar, zere manualmente o `annualPotCents` no arquivo `data/demo-league-state.json`, recarregue a página e confirme que o valor continua zero em vez de voltar para o valor do seed.

---

## Bug 6 — Mock de dados com valores financeiros hardcoded

### Severidade
Médio — o estado inicial ignora as configurações do admin.

### Arquivos afetados
- `src/lib/data/mock.ts` (linhas 287–288)

### Problema
A função `createMockSnapshot` em `mock.ts` define valores financeiros fixos, ignorando as configurações que o admin pode ter feito:

```ts
financialSummary: {
  dailyPrizePool: formatCurrency(dailyPaidPlayers * 10),  // ← R$ 10 fixo
  annualPot: formatCurrency(200),                          // ← R$ 200 fixo
  dailyPaidPlayers,
  annualPaidPlayers,
}
```

O `10` usado no cálculo de `dailyPrizePool` é o valor de buy-in que estava no regulamento, mas se o admin mudar para R$ 15 ou R$ 20 nas configurações, o mock ainda calcula com R$ 10.

O `200` do `annualPot` é um chute inicial e não reflete o cálculo correto (que deveria ser buy-in anual × jogadores).

### Solução
Tornar os valores de buy-in configuráveis. A melhor forma é receber o buy-in como parâmetro ou ler das configurações. Como o `mock` é o estado seed inicial (antes do admin configurar nada), o valor pode permanecer como padrão R$ 10, mas precisa ser documentado como tal.

Para corrigir de forma mais robusta:

1. Trocar o `10` hardcoded por uma constante no topo do arquivo:
```ts
const DEFAULT_BUY_IN = 10;
```

2. Trocar o `200` por um cálculo baseado na quantidade de jogadores que pagaram anualmente:
```ts
annualPot: formatCurrency(annualPaidPlayers * DEFAULT_BUY_IN),
```

### Implementação

**Arquivo: `src/lib/data/mock.ts`**

1. No topo do arquivo, adicione:
```ts
const DEFAULT_BUY_IN = 10;
```

2. Localize a função `createMockSnapshot` (linha 255). Substitua o `financialSummary`:

```ts
financialSummary: {
  dailyPrizePool: formatCurrency(dailyPaidPlayers * DEFAULT_BUY_IN),
  annualPot: formatCurrency(annualPaidPlayers * DEFAULT_BUY_IN),
  dailyPaidPlayers,
  annualPaidPlayers,
}
```

### Verificação
Verifique se o estado inicial do sistema continua mostrando valores consistentes quando não há configuração salva.

---

## Bug 7 — Etapas de teste não são filtradas no `demo-league-store.ts`

### Severidade
Baixo — inconsistência entre os dois caminhos de finalização.

### Arquivos afetados
- `src/lib/data/demo-league-store.ts` (função `finalizeStoredStage`, linha 195)

### Problema
O arquivo `demo-league-state.ts` tem lógica específica para tratar etapas de teste (`isTest: true`): elas não contribuem para o pote anual, não alteram o ranking anual e são marcadas como teste no histórico (linhas 299, 333–360).

O arquivo `demo-league-store.ts` não tem nenhum tratamento para `isTest`. Se uma etapa marcada como teste for finalizada por esse caminho, ela vai ser contabilizada como uma etapa real e vai somar pontos ao ranking e dinheiro ao pote anual.

Na prática, como o app em produção usa `demo-league-state.ts` (via API), esse bug não afeta o usuário final. Mas é uma inconsistência que pode causar problemas se algum código novo usar `demo-league-store.ts` no futuro.

### Solução
Adicionar a mesma lógica de tratamento de `isTest` em `finalizeStoredStage` no `demo-league-store.ts`.

### Implementação

**Arquivo: `src/lib/data/demo-league-store.ts`**

1. Localize a função `finalizeStoredStage` (linha 195). Após o cálculo de `annualContributionCents` e `dailyPrizeCents` (linhas 284–291), adicione:

```ts
const effectiveAnnualContributionCents = stage.isTest ? 0 : annualContributionCents;
```

2. Use `effectiveAnnualContributionCents` em vez de `annualContributionCents` no `annualPotCents` (linha 334) e no `historySummary` (linha 316):

```ts
annualPotCents: store.annualPotCents + effectiveAnnualContributionCents,
```

3. Marque o `historySummary` e `historyDetail` como teste:

```ts
const historySummary: HistoryStageSummary = {
  ...,
  isTest: stage.isTest ?? false,
};
```

4. Se for uma etapa de teste, pule a atualização do `annualRankingStats`, `annualStagePoints` e `stageMatchPoints` (assim como o `demo-league-state.ts` faz nas linhas 333–344). Apenas adicione ao `history` e `stageHistoryDetails`.

### Verificação
Como o `demo-league-store.ts` não é o caminho padrão em produção, esse bug é mais teórico. Para validar a correção, crie um teste manual: marque uma etapa como teste, finalize-a, e confirme que o pote anual e o ranking não foram alterados.

---

## Ajuste 8 — Pote anual: ajustar valor para o real (R$ 175,00)

### Severidade
Alto — o valor exibido não bate com a contabilidade real do admin.

### Arquivos afetados
- `data/demo-league-state.json` (campo `annualPotCents`)
- `src/lib/data/demo-league-state.ts` (função `mergeLeagueStates`)

### Problema
O admin identificou que o valor do pote anual exibido pelo sistema (R$ 260,00) não corresponde ao valor real acumulado. A contabilidade manual do admin indica que o valor correto deveria ser R$ 175,00, com mais R$ 25,00 ainda a receber de jogadores que devem.

A diferença de R$ 60,00 entre o que o sistema mostra e o valor real provável (R$ 200,00) sugere que o sistema está contabilizando algum pagamento a mais — possivelmente jogadores marcados como `annualPaid: true` que não efetivamente pagaram, ou uma etapa inteira registrada com mais pagantes do que realmente houve.

### Por que isso é importante
O pote anual é o valor principal que será distribuído na mesa final. Se o sistema mostra um valor incorreto, o admin pode tomar decisões erradas (por exemplo, pensar que tem mais dinheiro disponível do que realmente tem) ou os jogadores podem ficar surpresos quando a premiação for menor do que o esperado.

### Solução
Há duas correções a fazer:

**Correção 1 — Ajuste imediato do valor guardado:**

Abrir o arquivo `data/demo-league-state.json` e alterar o valor de `annualPotCents` para `17500` (R$ 175,00). Esse é o valor que o admin confirmou como o valor real acumulado.

**Correção 2 — Prevenir que o valor seja sobrescrito pelo seed:**

A função `mergeLeagueStates` em `demo-league-state.ts` (linha 998) usa `bundled.annualPotCents || current.annualPotCents`. Se o `bundled` (que vem do mesmo arquivo) tiver o valor antigo, ele sobrescreve. Isso pode causar a divergência em alguns cenários.

A correção de longo prazo envolve:
- Validar o valor manualmente e travar
- Ou reescrever a função de merge para que o valor atual sempre tenha prioridade
- Ou criar uma forma de "trancar" o valor do pote para que o admin possa editá-lo

### Implementação

**Correção 1 — Ajuste imediato do JSON:**

1. Abrir `C:\Caio\SHPL\data\demo-league-state.json`
2. Localizar a linha com `"annualPotCents": 26000`
3. Alterar para `"annualPotCents": 17500`
4. Salvar o arquivo
5. Reiniciar o servidor Next.js se estiver rodando (ou aguardar o hot reload)

**Correção 2 — Proteger o valor do merge:**

No arquivo `src/lib/data/demo-league-state.ts`, localizar a função `mergeLeagueStates` (linha 984). Substituir a linha:

```ts
annualPotCents: bundled.annualPotCents || current.annualPotCents,
```

Por:

```ts
annualPotCents: current.annualPotCents ?? bundled.annualPotCents,
```

Com essa mudança, o valor atual (`current`) sempre tem prioridade. Se ele for `null` ou `undefined`, cai para o bundled. Isso garante que o valor que o admin acabou de salvar não seja sobrescrito por engano.

**Correção 3 (sugestão) — Bloquear edição do seed:**

Como a função `readState` lê o arquivo do usuário e o bundled do mesmo arquivo (mesmo path), e o bundled tem prioridade em vários campos, vale considerar separar os arquivos ou remover a lógica de merge redundante.

Outra opção é adicionar um campo `seedApplied: true` no JSON, e quando ele existir, não fazer mais o merge. Assim, o seed só é aplicado uma vez, na primeira inicialização.

### Verificação
Após o ajuste do JSON e a reinicialização:
1. A dashboard deve mostrar "R$ 175,00" no Pote Anual Total
2. A tela de Configurações → Campeonato também deve mostrar "R$ 175,00"
3. Se o admin finalizar uma nova etapa com pagamentos, o pote deve somar corretamente a partir dos R$ 175,00 (ex: +R$ 10 para cada jogador que pagou anualmente)

---

## Funcionalidade 9 — Implementar controle de dívidas (quem está devendo e quanto)

### Severidade
Funcionalidade nova — não existe hoje. Necessário para o admin ter controle financeiro real.

### Arquivos afetados (a criar/alterar)
- `src/lib/domain/types.ts` (novo tipo `DebtStatus` ou `OutstandingDebt`)
- `src/lib/data/demo-league-state.ts` (cálculo de dívidas)
- `src/lib/data/demo-admin-store.ts` (persistência dos jogadores)
- `src/components/shpl-dashboard.tsx` (card "Valores em aberto")
- `src/components/shpl-history-page.tsx` ou nova página de débitos

### Problema
Hoje o sistema não tem como responder perguntas como:
- "Quem jogou em uma etapa mas não pagou o buy-in?"
- "Quanto cada jogador está devendo no acumulado da temporada?"
- "Qual o total de valores em aberto a receber?"

O admin tem que fazer essa conta no papel. Isso gera divergência entre o que o sistema mostra e a realidade, e dificulta a cobrança.

### Por que isso é importante
Sem esse controle, o sistema sempre vai estar defasado em relação à realidade. O admin precisa de uma tela que mostre:
- Lista de jogadores que devem
- Valor individual de cada dívida
- Total acumulado em aberto
- Histórico de quem pagou e quando

### Solução
Implementar um sistema de controle de dívidas que:

1. **Registre quem jogou em cada etapa**: Para cada etapa finalizada, guardar a lista de jogadores que estavam presentes (independente de terem pago ou não).

2. **Calcule a dívida de cada jogador**: Para cada jogador que jogou sem pagar, somar o buy-in diário e o buy-in anual que ficaram em aberto.

3. **Exiba um painel de valores em aberto**: Tela dedicada (ou card na dashboard) mostrando:
   - Total em aberto
   - Lista de jogadores devedores
   - Valor individual de cada um
   - Etapa em que a dívida foi gerada

### Implementação

**Passo 1 — Estender o tipo do jogador persistido**

No arquivo `src/lib/data/demo-admin-store.ts` ou onde o tipo `PlayerRosterEntry` é definido, adicionar campos opcionais para registrar histórico de pagamento:

```ts
type PlayerRosterEntry = {
  id: string;
  fullName: string;
  nickname: string;
  email?: string;
  active: boolean;
  // Novos campos para controle de dívidas
  annualPaidAt?: string | null;  // ISO date da última vez que pagou anual
  paidStages?: string[];  // IDs das etapas em que pagou o diário
  owedStages?: string[];  // IDs das etapas em que ficou devendo
};
```

**Passo 2 — Registrar dívidas ao finalizar etapa**

No arquivo `src/lib/data/demo-league-state.ts`, na função `finalizeStage`, antes de gravar o estado, calcular a lista de jogadores que jogaram mas não pagaram. Persistir isso em um novo campo do estado:

```ts
// Dentro de finalizeStage, após calcular finalRanking
const stageOwedPlayers: string[] = input.players
  .filter((player) => !player.annualPaid || !player.dailyPaid)
  .map((player) => player.playerId);

// Adicionar ao estado gravado
await writeState({
  ...nextState,
  outstandingDebts: [
    ...state.outstandingDebts,
    {
      stageId: stage.id,
      stageTitle: stage.title,
      stageDate: stage.stageDate,
      owedByPlayerId: stageOwedPlayers,
      amountPerPlayer: input.buyInDaily + input.buyInAnnual,
    },
  ],
});
```

**Passo 3 — Tipo para o estado**

```ts
type OutstandingDebt = {
  stageId: string;
  stageTitle: string;
  stageDate: string;
  owedByPlayerId: string[];
  amountPerPlayer: number;  // em centavos
};

type DemoLeagueStateData = {
  // ... campos existentes
  outstandingDebts: OutstandingDebt[];
};
```

**Passo 4 — Calcular totais em aberto**

Adicionar uma função que soma as dívidas por jogador:

```ts
function calculateOutstandingDebts(
  debts: OutstandingDebt[],
  playerNameById: Map<string, string>
) {
  const byPlayer = new Map<string, { playerId: string; playerName: string; totalCents: number; stages: OutstandingDebt[] }>();

  for (const debt of debts) {
    for (const playerId of debt.owedByPlayerId) {
      const entry = byPlayer.get(playerId) ?? {
        playerId,
        playerName: playerNameById.get(playerId) ?? "Jogador",
        totalCents: 0,
        stages: [],
      };
      entry.totalCents += debt.amountPerPlayer;
      entry.stages.push(debt);
      byPlayer.set(playerId, entry);
    }
  }

  return Array.from(byPlayer.values()).sort((a, b) => b.totalCents - a.totalCents);
}
```

**Passo 5 — Expor no snapshot**

Em `getDemoLeagueSnapshot`, adicionar ao retorno:

```ts
return {
  ...baseSnapshot,
  // ... outros campos
  outstandingDebts: {
    totalCents: calculateTotalDebts(state.outstandingDebts),
    byPlayer: calculateOutstandingDebts(state.outstandingDebts, playerNameById),
  },
};
```

**Passo 6 — Adicionar card na dashboard**

No arquivo `src/components/shpl-dashboard.tsx`, adicionar um card que mostra:

- Total em aberto (R$ XX,XX)
- Número de jogadores devedores
- Botão "Ver detalhes" que abre uma tela com a lista completa

```tsx
<MetricCard
  label="Valores em aberto"
  value={formatCurrency(snapshot.outstandingDebts.totalCents / 100)}
  helper={`${snapshot.outstandingDebts.byPlayer.length} jogadores`}
/>
```

**Passo 7 — Criar tela de detalhes**

Criar um novo componente `OutstandingDebtsView` que mostra a tabela:

| Jogador | Valor devido | Etapas |
|---------|-------------|--------|
| João    | R$ 20,00    | Etapa 03, Etapa 04 |
| Maria   | R$ 10,00    | Etapa 04 |

### Verificação
1. Criar uma etapa de teste com 2 jogadores, marcar 1 como pagante e outro não
2. Finalizar a etapa
3. Abrir a dashboard e confirmar que aparece o valor em aberto
4. Clicar em "Ver detalhes" e confirmar que a lista mostra o jogador devedor
5. Marcar o jogador como tendo pago (futuro: botão de "confirmar pagamento") e confirmar que o valor some da lista

### Observações
- A dívida pode crescer se o jogador participar de várias etapas sem pagar
- É importante considerar se o admin pode dar "baixa" em uma dívida (registrar que o jogador pagou depois)
- O regulamento pode precisar ser atualizado para definir o que acontece com quem está devendo (perde pontos? perde posição? fica impedido de jogar?)

---

## Próximos passos

Aplicar na ordem:

1. **Ajuste 8 (Alto)** — Ajustar manualmente o `annualPotCents` no JSON para 17500 e proteger o valor no merge
2. **Funcionalidade 9 (Nova)** — Implementar controle de dívidas
3. Bug 1 e Bug 2 — atualizar `demo-league-store.ts` para alinhar com a nova regra de pontuação (escala 10/8/6/4/2) e nova ordenação (vitórias primeiro). Atualizar o texto do regulamento.
4. Bug 3 e Bug 4 depois (médios, afetam UI)
5. Bug 5 e Bug 6 (médios, edge cases)
6. Bug 7 por último (baixa prioridade, melhoria de consistência)

Após cada item, validar com o usuário antes de prosseguir.
