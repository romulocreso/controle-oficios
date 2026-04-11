# Controle de Ofícios

Arquivos prontos para GitHub Pages + Supabase.

## 1. Rodar o SQL
No Supabase, abra `SQL Editor` e execute o arquivo `supabase_schema.sql`.

## 2. Criar usuário
No Supabase, vá em `Authentication > Users` e crie um usuário com email e senha.

## 3. Subir no GitHub
Envie para a raiz do repositório:
- index.html
- style.css
- app.js
- config.js
- supabase_schema.sql
- README.md

## 4. Ativar o GitHub Pages
No GitHub:
- Settings
- Pages
- Source: Deploy from a branch
- Branch: main
- Folder: /(root)

## 5. Acessar
A URL deve ficar parecida com:
`https://SEUUSUARIO.github.io/controle-oficios/`

## Observação importante
O login só funciona depois que:
- a tabela existir no Supabase
- houver um usuário criado no Auth
- o `config.js` estiver com URL e chave corretas
