# Ativação — Thales Franco Training Studio

## 1. Supabase

Projeto: `https://ojuadkbbbslbusmesanj.supabase.co` (não acrescente `/rest/v1` nas variáveis).

1. No SQL Editor execute `supabase/001_schema.sql`.
2. Em Authentication → Users, crie o usuário de Thales com e-mail real e senha forte. Marque o e-mail como confirmado.
3. Edite o e-mail em `supabase/002_authorize_thales.sql` e execute. Confirme que a consulta final retorna esse e-mail.
4. Desabilite novos cadastros públicos em Authentication. O aplicativo não tem formulário de cadastro e só permite usuários da tabela `admins`.
5. Copie a URL, a chave pública anon (ou publishable) e a chave privada service_role (ou secret) para as variáveis correspondentes. Nunca compartilhe a chave privada no chat ou no Git.

As tabelas têm RLS: somente administradores acessam seus próprios alunos e treinos. Publicações e histórico só podem ser escritos pelas rotas autenticadas do servidor. Visitantes não têm acesso direto às tabelas. O link aleatório da publicação permite ler apenas o conteúdo do treino, sem nomes, aniversários ou contatos. Quem tiver o link pode compartilhá-lo; revogue em Configurações quando necessário.

## 2. Vercel

1. Importe `kaueramone/thalesfranco` na conta da Vercel. Framework: **Next.js**, diretório raiz: `./`, comando de build: `npm run build`.
2. Configure as variáveis de `.env.example` em Project → Settings → Environment Variables. Não é necessário enviar `.env` ao repositório.
3. `APP_URL` deve ser a URL HTTPS real do site, sem barra final. É usada nos links enviados, e não é deduzida de cabeçalhos da requisição.
4. Redeploy após alterar variáveis. As duas variáveis `NEXT_PUBLIC_*` são incorporadas no build.
5. Ative produção na branch `main`; futuros pushes disparam o deploy se a integração Git estiver conectada.

## 3. E-mail — Resend

1. Crie uma conta no Resend, adicione seu domínio e valide os registros DNS solicitados.
2. Crie uma API key e configure `RESEND_API_KEY` na Vercel.
3. Configure `EMAIL_FROM`, por exemplo `Thales Franco <treinos@seu-dominio.com>`; o domínio precisa estar verificado.
4. Cada aluno recebe mensagem individual, um PDF anexado e um link para o treino com vídeos. Outros destinatários não são expostos.

Documentação: https://resend.com/docs/api-reference/emails/send-email

## 4. WhatsApp — Meta Cloud API

Não é uma automação do WhatsApp Web. É necessário cadastrar um número no WhatsApp Business Platform, concluir as verificações exigidas pela Meta e configurar faturamento quando aplicável.

1. Crie o aplicativo Business na Meta e configure o produto WhatsApp.
2. Configure token de acesso de produção, Phone Number ID e uma versão Graph API vigente no seu aplicativo em `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_GRAPH_VERSION` (formato `vNN.N`).
3. Crie um template chamado `treino_semanal`, em Português (Brasil), com **3 variáveis posicionais no corpo** e sem header obrigatório ou botão dinâmico. Use `WHATSAPP_TEMPLATE_LANGUAGE=pt_BR`.
4. Sugestão de corpo, a ser avaliada pela Meta:

```text
Olá, {{1}}! Seu treino da semana {{2}} com Thales Franco está disponível.
Confira a programação, assista aos vídeos e baixe o PDF: {{3}}
Se não quiser mais receber, avise o treinador.
```

As variáveis são, nessa ordem: nome do aluno, número da semana e URL HTTPS do treino. Cadastre valores de exemplo válidos. A categoria e a aprovação dependem da Meta. Se o template tiver outro nome, ajuste `WHATSAPP_TEMPLATE_NAME`. Não altere a quantidade/posição das variáveis sem atualizar a integração.

O WhatsApp recebe o link da página, onde há botão de download do PDF. Não envia o PDF como documento separado. O envio é individual para a lista de alunos, não para um grupo do WhatsApp.

Referência oficial: https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/

## 5. Operação semanal

1. Cadastre os alunos com nome, nascimento opcional e um ou ambos os contatos. Use WhatsApp internacional, por exemplo `+5511999999999`. Registre somente canais autorizados pelo aluno.
2. Crie ou duplique a programação. Os títulos são livres; blocos sugeridos: Warm-up, Running, Strength, HYROX Stations e Cool-down. O exemplo demonstrativo não é uma prescrição de treino.
3. Adicione exercícios e links HTTPS do YouTube. Prévia permite conferir o treino e abrir vídeos em pop-up.
4. Salve, clique em Enviar treino, selecione alunos/canais e confirme. Mantenha a página aberta durante o lote.
5. Consulte Envios. O processamento é individual; falhas de um aluno não interrompem os outros.

## 6. Comportamento dos envios

- Publicar cria uma cópia imutável. O mesmo conteúdo reutiliza a publicação. Editar o treino produz uma nova versão no próximo envio; alunos com o link antigo continuam vendo a versão original.
- Existe uma restrição única por publicação + aluno + canal. Cliques concorrentes não criam dois disparos. Resend também recebe uma chave de idempotência.
- `accepted`: provedor aceitou; **não é confirmação de entrega ou leitura**.
- `failed`: rejeição explícita do provedor. Corrija a configuração e confirme o mesmo envio novamente; somente falhas conhecidas são repetidas.
- `uncertain`: timeout, erro de rede ou erro de servidor do provedor. Não reenviar automaticamente, pois a mensagem pode já ter sido aceita.
- `processing`: execução em andamento ou interrompida antes de registrar o resultado. Também não é repetida automaticamente.
- Para os dois últimos casos, confira o painel do provedor. Se houver certeza de que não foi enviado, um administrador do banco pode corrigir o registro para `failed` antes de retentar. Não há botão que faça isso cegamente.
- Se fechar a página, apenas as tarefas já iniciadas continuam. Retomar o mesmo lote ignora as já aceitas. Esta versão não usa uma fila em segundo plano nem agenda envios automáticos: o Thales inicia o envio toda semana.
- Histórico apresenta os 200 registros mais recentes; os demais continuam no banco.

## 7. Verificação antes do primeiro lote real

Use apenas um contato seu como aluno de teste, com autorização dos canais. Confira login, persistência após atualizar, edição, link publicado, vídeo real e PDF. Teste cada canal separado e confira o recebimento no dispositivo. Só depois selecione os alunos reais.

Sem SQLs, chaves e configuração dos provedores não é possível validar disparos reais. O modo de demonstração é temporário, não persiste nem envia mensagens.

## Desenvolvimento

```sh
npm ci
# Copie .env.example para .env.local e preencha localmente.
npm run dev
npm test
npm run build
```

O PDF é gerado no servidor com a foto em `public/cover-photo.jpeg`, sobreposição escura e logo branca centralizada. Ele tem links clicáveis; iframes são exibidos apenas na página web. A foto original e as logos fornecidas foram preservadas na pasta de trabalho.
