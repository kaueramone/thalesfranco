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

## 4. WhatsApp — compartilhamento manual (sem API)

O painel não precisa de QR Code nem credenciais Meta para esta modalidade.

1. Configure `APP_URL` com o endereço HTTPS público do site na Vercel. Links localhost são bloqueados para compartilhamento.
2. No editor, clique em **WhatsApp**. O sistema salva o treino antes de abrir a janela.
3. Clique em **Preparar link do treino**. Isso publica uma cópia imutável da programação, sem contatos dos alunos.
4. Use **Copiar mensagem** para colar no grupo ou **Abrir WhatsApp** para escolher o destino. Em dispositivos compatíveis, **Compartilhar…** abre a seleção de aplicativos.
5. Para um aluno específico, use **Abrir conversa** na lista. Só aparecem alunos ativos com telefone válido e autorização para WhatsApp.
6. Confirme o envio dentro do WhatsApp. O site não envia automaticamente nem consegue confirmar entrega. Abrir/copiar não cria registros de mensagens enviadas.

A mensagem contém o link do treino. O aluno assiste aos vídeos e baixa o PDF na página, sem login. O PDF não é anexado automaticamente ao WhatsApp.

A integração Meta anterior permanece no backend como opção futura, mas não é acionada pelo fluxo manual. As variáveis `WHATSAPP_*` são opcionais e não precisam ser preenchidas.

## 5. Operação semanal

1. Cadastre os alunos com nome, nascimento opcional e um ou ambos os contatos. Use WhatsApp internacional, por exemplo `+5511999999999`. Registre somente canais autorizados pelo aluno.
2. Crie ou duplique a programação. Os títulos são livres; blocos sugeridos: Warm-up, Running, Strength, HYROX Stations e Cool-down. O exemplo demonstrativo não é uma prescrição de treino.
3. Adicione exercícios e links HTTPS do YouTube. Prévia permite conferir o treino e abrir vídeos em pop-up.
4. Salve, clique em Enviar e-mail, selecione os alunos e confirme. Para WhatsApp, use o botão separado e confirme no aplicativo. Mantenha a página aberta durante o lote.
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

Sem SQLs e chaves do Supabase não é possível publicar treinos. E-mails exigem Resend configurado; compartilhamento manual do WhatsApp exige uma URL pública, sem provedor adicional. O modo de demonstração é temporário, não persiste nem envia mensagens.

## Desenvolvimento

```sh
npm ci
# Copie .env.example para .env.local e preencha localmente.
npm run dev
npm test
npm run build
```

O PDF é gerado no servidor com a foto em `public/cover-photo.jpeg`, sobreposição escura e logo branca centralizada. Ele tem links clicáveis; iframes são exibidos apenas na página web. A foto original e as logos fornecidas foram preservadas na pasta de trabalho.
## Ícones e instalação

O favicon original está em `favicon.png`. O projeto inclui favicon de navegador, Apple Touch Icon e ícones de 192/512 px com manifest para atalhos no celular e no computador. A experiência continua exigindo internet e login; não há cache offline de dados privados.

O endereço público padrão é `https://thalesfranco.vercel.app`. `APP_URL` pode substituí-lo; se essa variável já estiver configurada na Vercel, mantenha o mesmo endereço HTTPS e faça redeploy.
