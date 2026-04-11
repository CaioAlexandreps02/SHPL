# Live Lab Training

Este espaco guarda a trilha local para evoluir o reconhecimento das cartas do board.

## Fluxo atual

1. No `live-lab`, o admin salva e rotula as cartas em `Dataset local das cartas`.
2. O admin clica em `Exportar dataset` e baixa um arquivo `.json`.
3. O script `prepare_dataset.py` converte esse `.json` em imagens prontas para treino.
4. O script `train_card_classifiers.py` treina os classificadores iniciais de `rank` e `naipe`.

## Estrutura

- `requirements.txt`
  Dependencias opcionais para o treino local.
- `prepare_dataset.py`
  Converte o export do navegador em pastas de imagens por `rank` e `naipe`.
- `train_card_classifiers.py`
  Treina classificadores iniciais usando `KNN`.

## Como usar

### 1. Exportar o dataset no navegador

- Abra `Live Lab da Mesa`
- Entre em `Administracao`
- Va em `Dataset local das cartas`
- Clique em `Exportar dataset`

Isso baixa um arquivo no formato:

- `shpl-live-lab-card-dataset-YYYYMMDD-HHMMSS.json`

### 2. Preparar o dataset para treino

No PowerShell, dentro do projeto:

```powershell
python .\experimental\live-lab\training\prepare_dataset.py `
  --input "C:\caminho\do\arquivo-exportado.json" `
  --output ".\experimental\live-lab\training\prepared"
```

O script gera:

- `prepared\images\raw`
- `prepared\images\rank\<rank>`
- `prepared\images\suit\<naipe>`
- `prepared\manifest.json`

### 3. Instalar dependencias do treino

```powershell
python -m pip install -r .\experimental\live-lab\training\requirements.txt
```

### 4. Treinar os classificadores

```powershell
python .\experimental\live-lab\training\train_card_classifiers.py `
  --manifest ".\experimental\live-lab\training\prepared\manifest.json" `
  --output ".\experimental\live-lab\training\models"
```

O treino gera:

- `models\rank-model.joblib`
- `models\suit-model.joblib`
- `models\training-summary.json`

## Observacoes

- O dataset local fica no navegador via IndexedDB.
- O classificador inicial usa `KNN`, que serve como ponto de partida rapido.
- Para melhorar o resultado real da mesa, o ideal e adicionar mais exemplos:
  - cartas tortas
  - cartas mais distantes
  - sombra
  - reflexo
  - iluminacao real do jogo
