# Migração do Sites para Supabase

Estado: estrutura preparada; importação e ligação da aplicação ainda pendentes.

## Criar o destino

1. Abrir https://supabase.com/dashboard e criar um projeto chamado `vidas-que-curam`.
2. Escolher a organização, a região mais próxima dos utilizadores e guardar a palavra-passe da base de dados num gestor de palavras-passe.
3. Aguardar que o projeto esteja pronto e obter o Project URL nas definições/API do projeto.
4. Aplicar `migrations/0001_sites_database.sql` apenas numa base nova, sem tabelas com estes nomes.

## Dados e compatibilidade

A leitura integral de 12 de novembro de 2026 encontrou 5 contas, 7 respostas,
0 páginas editoriais, 6 sessões e 0 registos de tentativas de acesso.
Esta leitura é uma fotografia do momento; a aplicação continua a aceitar dados
no Sites. Fazer uma nova exportação na passagem definitiva para o Supabase.

Os dados privados, hashes de palavras-passe e sessões não devem entrar no GitHub.
Preservar os identificadores e os timestamps em milissegundos; usar `bigint`
para evitar ultrapassar o limite do inteiro PostgreSQL de 32 bits.

As contas usam autenticação própria com PBKDF2-SHA256, não Supabase Auth.
Copiar estas tabelas preserva os hashes existentes, mas não cria utilizadores
em `auth.users`. A autenticação administrativa também depende das variáveis
de servidor `ADMIN_USERNAME` e `ADMIN_PASSWORD`.

Antes da passagem definitiva, adaptar o acesso da aplicação de D1/SQLite para
PostgreSQL ou para a API Supabase no servidor, testar registo, login, respostas
privadas e acesso editorial. A migração SQL, por si só, não muda a aplicação.
As tabelas têm RLS e nenhum acesso para `anon` ou `authenticated`; o servidor
precisará de uma credencial própria, guardada como segredo, nunca no browser.

Na passagem definitiva, suspender escritas na origem, exportar novamente,
importar num destino vazio sem substituir dados existentes e comparar os
registos e contagens antes de mudar o tráfego. Manter a origem para reversão.
As sessões podem ser invalidadas nessa passagem, exigindo novo login.
