-- Primeiro crie o usuário em Authentication > Users > Add user, com senha.
-- Substitua pelo e-mail real ANTES de executar. Não use este arquivo para senhas.
insert into public.admins(user_id)
select id from auth.users where email='SUBSTITUA_PELO_EMAIL_DO_THALES'
on conflict do nothing;
-- O resultado deve conter o e-mail do Thales.
select u.email from public.admins a join auth.users u on u.id=a.user_id;
