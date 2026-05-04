import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  readServerJsonDocument,
  writeServerJsonDocument,
} from "@/lib/data/server-json-store";
import {
  readServerBinaryDocument,
  writeServerBinaryDocument,
} from "@/lib/data/server-binary-store";

export type RegulationSection = {
  id: string;
  number: string;
  title: string;
  summary: string;
  paragraphs: string[];
};

export type RegulationDocument = {
  title: string;
  subtitle: string;
  intro: string;
  versionLabel: string;
  updatedAtLabel: string;
  pdfFileName: string;
  sections: RegulationSection[];
};

const regulationDocumentName = "shpl-regulation.json";
const regulationPdfDocumentName = "shpl-regulation/regulamento-shpl.pdf";

function buildDefaultRegulation(): RegulationDocument {
  return {
    title: "Regulamento SHPL",
    subtitle:
      "Visualize as regras oficiais da Shark Home Poker League, organizadas por assunto para facilitar a consulta durante o campeonato.",
    intro:
      "Este regulamento reune as regras gerais da SHPL 2026, incluindo participacao, buy-in, blinds, criterios de desempate, ranking anual e mesa final.",
    versionLabel: "1a SHPL 2026",
    updatedAtLabel: "09/02/2026",
    pdfFileName: "regulamento-shpl.pdf",
    sections: [
      {
        id: "disposicoes-gerais",
        number: "1",
        title: "Disposicoes gerais",
        summary: "Objetivo do campeonato, dinamica anual e espirito da liga.",
        paragraphs: [
          "A Shark Home Poker League (SHPL) e um campeonato anual de poquer entre amigos, criado para unir competitividade, diversao e organizacao.",
          "Ao longo do ano, sao realizados diversos encontros de acordo com a disponibilidade do grupo. Em cada encontro, os jogadores disputam partidas de poquer e, ao final, e definido o campeao da etapa, que recebe a premiacao do dia.",
          "Ademais, todos os encontros somam pontos para um ranking anual, que serve como base para a classificacao da mesa final da SHPL, onde sera disputada a premiacao anual acumulada.",
          "A SHPL prioriza regras claras para evitar discussoes, garantindo resenha, respeito entre os jogadores e bom andamento dos jogos.",
          "Os encontros podem contar com convidados, quando necessario para completar mesas ou ampliar o grupo, conforme as regras deste regulamento.",
        ],
      },
      {
        id: "modalidade-do-jogo",
        number: "2",
        title: "Modalidade do jogo",
        summary: "Variante oficial e fundamentos da mesa.",
        paragraphs: [
          "A variante oficial da SHPL e Texas Hold'em No-Limit.",
          "Cada jogador recebe duas cartas fechadas.",
          "As cartas comunitarias sao usadas para formar a melhor mao de cinco cartas.",
          "Nao ha limite maximo de aposta.",
        ],
      },
      {
        id: "participacao",
        number: "3",
        title: "Participacao",
        summary: "Minimo e maximo de jogadores, divisao de mesas e convidados.",
        paragraphs: [
          "Cada encontro deve ter no minimo 4 jogadores e no maximo 16 jogadores.",
          "Cada mesa pode ter ate 8 jogadores. Se houver mais de 8 participantes, as pessoas sao divididas em duas ou mais mesas.",
          "As mesas jogam simultaneamente ate o numero total de jogadores ser reduzido e acontecer a unificacao.",
          "Se o total de jogadores for igual ou superior a 14, a unificacao acontece quando restarem 8 jogadores. Se for inferior a 14, a unificacao acontece quando restarem 6 jogadores.",
          "A partir da unificacao, o jogo continua em uma unica mesa ate a definicao do campeao da etapa.",
          "Os participantes podem convidar jogadores externos. Convidados jogam normalmente e, havendo interesse mutuo, podem passar a integrar o grupo nas proximas etapas.",
        ],
      },
      {
        id: "buyin-premiacao",
        number: "4",
        title: "Buy-in e premiacao",
        summary: "Valores da etapa, divisao entre premio do dia e pote anual.",
        paragraphs: [
          "Cada encontro tem buy-in total de R$ 20,00 por jogador.",
          "O valor e dividido em duas partes: R$ 10,00 para a premiacao da etapa e R$ 10,00 para o pote anual da SHPL.",
          "O valor arrecadado na etapa e pago integralmente ao campeao do encontro.",
          "Ademais, o campeao da etapa recebe um trofeu simbolico representando a conquista daquela etapa, alem da premiacao em dinheiro.",
          "O valor acumulado ao longo do ano e disputado exclusivamente na mesa final da SHPL.",
        ],
      },
      {
        id: "local-dos-encontros",
        number: "5",
        title: "Local dos encontros",
        summary: "Definicao colaborativa do local de cada etapa.",
        paragraphs: [
          "O local de cada encontro e definido em comum acordo no grupo da SHPL.",
          "A cada etapa, os participantes decidem previamente onde o encontro sera realizado, considerando disponibilidade, estrutura e consenso entre os jogadores.",
        ],
      },
      {
        id: "formato-dos-encontros",
        number: "6",
        title: "Formato dos encontros",
        summary: "Quantidade de partidas e restricoes da estrutura.",
        paragraphs: [
          "Cada encontro pode ter uma ou mais partidas.",
          "Ao final do encontro e definido o campeao da etapa.",
          "Nao existe rebuy.",
          "Nao existe add-on.",
          "Cada jogador participa com uma unica entrada por partida.",
        ],
      },
      {
        id: "stack-e-blinds",
        number: "7",
        title: "Stack e blinds",
        summary: "Stack inicial, tempo de nivel e estrutura oficial.",
        paragraphs: [
          "O stack inicial e de 5.000 fichas por jogador.",
          "Cada nivel de blind dura 5 minutos.",
          "A estrutura oficial de blinds e: 25/50, 50/100, 100/200, 200/400, 500/1.000, 1.000/2.000, 2.000/4.000, 4.000/8.000, 5.000/10.000 e 10.000/20.000 como nivel final para encerramento.",
        ],
      },
      {
        id: "botao-e-ordem",
        number: "8",
        title: "Botao e ordem de acao",
        summary: "Definicao do dealer e ordem de fala nas streets.",
        paragraphs: [
          "O botao de dealer e definido aleatoriamente no inicio do encontro.",
          "A cada mao, o botao avanca uma posicao no sentido horario.",
          "No pre-flop, a ordem de acao comeca a esquerda do Big Blind.",
          "No flop, turn e river, a ordem de acao comeca a esquerda do botao.",
        ],
      },
      {
        id: "showdown",
        number: "9",
        title: "Showdown",
        summary: "Regras de exibicao de cartas ao final da mao.",
        paragraphs: [
          "O vencedor da mao deve obrigatoriamente mostrar as cartas.",
          "Jogadores derrotados podem optar por nao mostrar as cartas.",
          "Em maos com all-in, todos os jogadores envolvidos devem mostrar as cartas.",
        ],
      },
      {
        id: "desempate-da-etapa",
        number: "10",
        title: "Criterio de desempate da etapa",
        summary: "Como desempatar colocacoes dentro da etapa.",
        paragraphs: [
          "O campeao da etapa sera o jogador com maior numero de vitorias nas partidas do encontro.",
          "Em caso de empate em qualquer colocacao, o desempate acontece apenas entre os jogadores empatados naquela posicao, sem participacao dos demais.",
          "Os criterios sao aplicados nesta ordem: partida de desempate rapida entre os empatados, com stack de 500 fichas e blinds de 5 minutos, ate restar um vencedor.",
          "Se ainda for necessario, pode ser aplicado all-in cego: cada jogador recebe uma carta virada, a maior carta vence e, em caso de empate, novas cartas sao distribuidas ate a definicao do vencedor.",
        ],
      },
      {
        id: "pontuacao-ranking-anual",
        number: "11",
        title: "Pontuacao do ranking anual",
        summary: "Como os pontos anuais sao distribuidos ao fim de cada encontro.",
        paragraphs: [
          "Ao final de cada encontro, os jogadores recebem a seguinte pontuacao: campeao da etapa 10 pontos, segundo lugar 7 pontos, terceiro lugar 5 pontos, participante que joga ate o final 3 pontos, jogador que sai antes do fim 1 ponto e ausente 0 ponto.",
          "Jogadores que sairem antes do fim do encontro nao disputam a premiacao da etapa, independentemente do numero de vitorias obtidas ate a saida.",
          "A pontuacao anual e sempre baseada no resultado final da etapa.",
        ],
      },
      {
        id: "saida-antecipada",
        number: "12",
        title: "Saida antecipada",
        summary: "Consequencias para quem deixa a etapa antes do fim.",
        paragraphs: [
          "Jogador que sair antes do fim do encontro nao disputa a premiacao da etapa.",
          "Quem sai antes do fim recebe apenas 1 ponto no ranking anual.",
        ],
      },
      {
        id: "ranking-anual-desempate",
        number: "13",
        title: "Ranking anual e desempate",
        summary: "Regras de classificacao do acumulado do ano.",
        paragraphs: [
          "O ranking anual e definido pela soma total de pontos.",
          "Em caso de empate, os criterios sao aplicados nesta ordem: maior numero de vitorias de etapa no ano, maior numero de participacoes no ano, melhor resultado no ultimo encontro do ano e, por fim, empate tecnico.",
        ],
      },
      {
        id: "classificacao-mesa-final",
        number: "14",
        title: "Classificacao para a mesa final",
        summary: "Quantidade de classificados e regras para empates.",
        paragraphs: [
          "A mesa final da SHPL pode ter entre 4 e 8 jogadores classificados.",
          "O numero de classificados e definido com base na quantidade de participantes ao longo do ano, frequencia de participacao e distribuicao de pontos do ranking anual.",
          "A expectativa padrao e uma mesa final com 6 jogadores, mas esse numero pode ser ajustado conforme o cenario do ano.",
          "Em caso de empate tecnico nas posicoes de classificacao, a mesa final pode contar com um jogador adicional, respeitando o limite maximo de 8 jogadores.",
          "Se o numero de classificados ultrapassar 8 por causa de empates, o desempate deve ser resolvido antes da mesa final, conforme criterios definidos pelo grupo.",
        ],
      },
      {
        id: "mesa-final",
        number: "15",
        title: "Mesa final da SHPL",
        summary: "Estrutura especifica da mesa final.",
        paragraphs: [
          "A mesa final tera entre 4 e 8 jogadores, conforme definido pelo ranking anual.",
          "O stack inicial da mesa final e de 10.000 fichas por jogador.",
          "O tempo de blind na mesa final e de 10 minutos.",
          "Nao existe rebuy nem add-on.",
          "A mesa final define o campeao anual da SHPL.",
        ],
      },
      {
        id: "premiacao-anual",
        number: "16",
        title: "Premiacao anual",
        summary: "Distribuicao do premio acumulado da temporada.",
        paragraphs: [
          "O premio anual e formado pela soma dos valores acumulados ao longo dos encontros do ano.",
          "A premiacao e distribuida entre todos os jogadores da mesa final, variando de acordo com a quantidade de classificados.",
          "A divisao segue os principios de maior porcentagem para o campeao, premiacao para todos os classificados da mesa final e ajuste proporcional conforme o numero de jogadores.",
          "Exemplo de distribuicao com 6 jogadores: 1o lugar 40%, 2o lugar 25%, 3o lugar 15%, 4o lugar 10%, 5o lugar 6% e 6o lugar 4%.",
          "Antes da mesa final, o grupo sera informado da tabela exata de divisao da premiacao conforme o numero final de classificados.",
          "A mesa final tambem pode contar com trofeus especiais para 1o, 2o e 3o colocados do ranking anual, definidos em comum acordo entre os classificados.",
        ],
      },
      {
        id: "disposicoes-finais",
        number: "17",
        title: "Disposicoes finais",
        summary: "Fechamento do regulamento e criterio de resolucao de casos nao previstos.",
        paragraphs: [
          "Situacoes nao previstas neste regulamento serao resolvidas em comum acordo entre os jogadores.",
          "O espirito da SHPL e a competicao saudavel entre amigos.",
          "Este regulamento passa a valer a partir do primeiro encontro oficial da SHPL.",
        ],
      },
    ],
  };
}

export async function getShplRegulationDocument() {
  return readServerJsonDocument(regulationDocumentName, buildDefaultRegulation);
}

export async function saveShplRegulationDocument(document: RegulationDocument) {
  await writeServerJsonDocument(regulationDocumentName, document);
  return document;
}

export async function readShplRegulationPdf() {
  return readServerBinaryDocument(
    regulationPdfDocumentName,
    async () => {
      const seedPath = path.join(process.cwd(), "data", "seed", "regulamento-shpl.pdf");
      return readFile(seedPath);
    },
    "application/pdf",
  );
}

export async function writeShplRegulationPdf(buffer: Buffer) {
  await writeServerBinaryDocument(regulationPdfDocumentName, buffer, "application/pdf");
}
