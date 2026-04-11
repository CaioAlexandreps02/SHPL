# Live Lab local-only assets

Estes arquivos e pastas ficam separados do código publicado no GitHub.

Eles existem para uso local de teste, treino ou runtime pesado:

- `opencv-temp/node_modules/`
- `training/models/`
- `training/prepared/`
- `sample.wav`
- `silence.wav`
- `silence-result.json`
- `whisper.cpp/models/`
- `whisper.cpp/Release/`
- `whisper.cpp/Win32/`
- `whisper.cpp/*.zip`

Resumo:

- O código do projeto continua no repositório.
- Os artefatos pesados ficam só na máquina local.
- Se precisarmos reconstruir algo depois, a lógica e os scripts continuam versionados.
