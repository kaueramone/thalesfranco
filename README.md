# Thales Franco · Training Studio

Painel privado para criação e distribuição de programações semanais HYROX. Next.js, React, TypeScript e Supabase, preparado para Vercel.

- Login e autorização exclusivos de administradores.
- Alunos com contatos e autorizações por canal.
- Editor de sete dias, blocos/exercícios e títulos editáveis, links do YouTube e prévia.
- PDF com capa fotográfica, logo e links, sem dados dos alunos.
- Página de leitura sem login com vídeos em pop-up e download do PDF.
- Resend e Meta WhatsApp Cloud API; resultados individuais e proteção contra envios duplicados.
- Links revogáveis e versões imutáveis do treino.
- Modo demonstração sem persistência ou disparos reais.

**Ativação:** siga [docs/CONFIGURACAO.md](docs/CONFIGURACAO.md). Os SQLs estão em `supabase/`. Contas externas, chaves e template Meta aprovado são necessários para o funcionamento real.

```sh
npm ci
npm run dev
```

Validação: `npm test`, `npm run typecheck`, `npm run build`.
