# Escala

Aplicação de cadastro de funcionários e planejamento de turnos com API Express e banco SQLite.

## Executar localmente

```bash
npm install
npm start
```

Abra `http://localhost:3000` no navegador.

O banco é criado automaticamente em `data/escala.sqlite`. Para produção, use Node.js `22.5+` e configure `PORT` e, opcionalmente, `DATABASE_PATH` para um volume persistente.

## Deploy no Vercel

O Vercel usa a função serverless em `api/[...path].js` e um banco Postgres externo. No projeto Vercel:

1. Crie um banco Postgres pela integração do Vercel Marketplace.
2. Confirme que a variável `POSTGRES_URL` foi adicionada aos ambientes `Production`, `Preview` e `Development`.
3. Faça o deploy novamente.

O schema (`employees` e `calendar_state`) é criado automaticamente na primeira chamada da API. O arquivo SQLite local não é usado no Vercel, porque o filesystem de funções serverless não é persistente.