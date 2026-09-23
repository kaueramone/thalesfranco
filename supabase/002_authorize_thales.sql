-- Primeiro crie o usuário em Authentication > Users > Add user, com senha.
-- E-mail do Thales definido. Não use este arquivo para senhas.
insert into public.admins(user_id)
select id from auth.users where email='thalescfranco.17@gmail.com'
on conflict do nothing;
-- O resultado deve conter o e-mail do Thales.
select u.email from public.admins a join auth.users u on u.id=a.user_id;
