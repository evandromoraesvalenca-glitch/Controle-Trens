# Controle Embarque Trens Online

Projeto separado para publicar o Controle Embarque Trens com banco Supabase e hospedagem Netlify.

## Arquivos principais

- `index.html`: aplicação publicada.
- `Checklist-Trens.html`: cópia da aplicação original mantida como referência.
- `controle-acesso-trens.js`: login, solicitações e aprovação de usuários.
- `embarques-viagens-simples.js`: módulo Embarques e Viagens.
- `supabase-config.js`: URL e chave pública do Supabase.
- `supabase-storage.js`: sincronização dos dados com Supabase.
- `supabase-schema.sql`: tabela e políticas necessárias no Supabase.
- `netlify.toml`: configuração de deploy no Netlify.

## Supabase

1. Crie um projeto no Supabase.
2. Abra SQL Editor.
3. Rode o conteúdo de `supabase-schema.sql`.
4. Copie a Project URL e a anon public key.
5. Cole esses valores em `supabase-config.js`.

## Primeiro acesso

- Nome: `Evandro Valença`
- Senha: `admin`

No primeiro acesso a plataforma solicita a troca da senha.

## Netlify

1. Crie um repositório no GitHub somente para esta pasta.
2. Envie os arquivos desta pasta para o repositório.
3. No Netlify, escolha `Add new site > Import from Git`.
4. Selecione o repositório.
5. Build command: deixe vazio.
6. Publish directory: `.`
7. Publique.

## GitHub

Na pasta `Controle-Embarque-Trens-Online`, rode:

```powershell
git init
git add .
git commit -m "Publica controle embarque trens online"
git branch -M main
git remote add origin URL_DO_REPOSITORIO
git push -u origin main
```
