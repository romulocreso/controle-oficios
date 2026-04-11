# Painel de Ofícios para GitHub Pages

Este pacote já vem com:
- `index.html`: página principal
- `styles.css`: estilos
- `app.js`: lógica da interface
- `data/oficios_unificados.csv`: base de dados inicial
- `schema_exemplo.csv`: modelo vazio para novas cargas

## Como usar
1. Crie um repositório no GitHub.
2. Envie todos estes arquivos.
3. Ative o GitHub Pages em **Settings > Pages** usando a branch `main`.
4. A página ficará disponível na URL do repositório.

## Como alimentar de forma mecânica
Substitua o arquivo `data/oficios_unificados.csv` por uma nova versão, mantendo as mesmas colunas.

Campos principais:
- `numero_oficio`
- `unidade`
- `classe`
- `recebido` → SIM / NAO / PENDENTE
- `data_recebimento` → formato `YYYY-MM-DD`
- `prazo_resposta_dias` → número inteiro
- `data_limite_resposta` → pode ficar em branco se quiser cálculo automático
- `respondido` → SIM / NAO / PENDENTE
- `data_resposta` → formato `YYYY-MM-DD`
- `observacoes`

## Regras da página
- Se houver `data_limite_resposta`, ela prevalece.
- Se `data_limite_resposta` estiver vazia e houver `data_recebimento` + `prazo_resposta_dias`, a página calcula a data limite.
- `status_prazo` é calculado automaticamente:
  - `RESPONDIDO`
  - `NO PRAZO`
  - `VENCE HOJE`
  - `VENCIDO`
  - `SEM PRAZO`
  - `NÃO RECEBIDO`
  - `PENDENTE DE DADOS`
