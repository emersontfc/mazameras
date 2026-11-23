# Instalação independente do ChatGPT Sites

Esta branch usa Node 24 e Next.js. A base SQLite e as fotografias ficam no
volume Docker `livro-medicina_livro_data`, montado em `/data`.
As contas e hashes existentes mantêm o formato original.
Esta preparação não transfere dados automaticamente e não muda o site publicado.

## Preparação na VPS

Não alterar AgentX, EventoX ou DigitalPay. A aplicação escuta apenas em
`127.0.0.1:3080`; Nginx continua responsável por HTTPS.

```bash
docker compose version
git clone --single-branch --branch vps-migration https://github.com/emersontfc/mazameras.git ~/livro-medicina
cd ~/livro-medicina
umask 077
cp deploy/env.example .env.vps
nano .env.vps
```

Configurar o **mesmo nome de utilizador do administrador existente** e uma senha
forte com pelo menos 16 caracteres. Guardar as credenciais num gestor de senhas;
não colar no chat. Configurar Resend se a recuperação por email já estiver ativa.

```bash
docker compose -f compose.vps.yaml build
docker compose -f compose.vps.yaml up -d
curl --fail http://127.0.0.1:3080/api/health
```

O teste esperado é `{"status":"ok"}`. Não cadastrar utilizadores ou escrever
respostas nesta cópia vazia antes da importação.

## Transferir os dados e imagens

A origem tem uma rota de exportação reservada ao administrador. O exportador
pede as credenciais **do site atual** no terminal e não mostra nem guarda a senha.
Essa senha pode ser diferente da nova senha configurada para a VPS.

Depois de confirmar que a cópia na VPS funciona, suspender as escritas na origem
para a exportação final. Não mudar o DNS até terminar a importação e validação.

```bash
mkdir -p backups
chmod 700 backups
docker compose -f compose.vps.yaml stop livro
docker compose -f compose.vps.yaml run --rm --no-deps \
  -v "$PWD/backups:/backup" livro node deploy/export-sites.mjs /backup/origem
```

O comando cria `backups/origem/database.json` e `uploads/` com as imagens.
Verifica os nove conjuntos de registos, calcula SHA-256 de todas as imagens e
recusa misturar exportações numa pasta existente. Se houver erro, manter o site
original e corrigir antes de avançar. Não publicar `backups/` no GitHub.

```bash
docker compose -f compose.vps.yaml run --rm --no-deps \
  -v "$PWD/backups/origem:/backup:ro" livro node deploy/import.mjs /backup
docker compose -f compose.vps.yaml up -d
```

O importador recusa substituir dados existentes e verifica se todos os ficheiros
referenciados existem. Requer nova sessão e invalida links de recuperação antigos.
Comparar contagens, respostas completas, fotografias e permissões antes de mudar
o tráfego. Confirmar login de autor/admin, perfil, edição, envio de fotos,
autorizações, prévia pessoal e exportação PDF.

## Domínio e HTTPS

Depois da validação, adicionar `deploy/nginx.conf` como vhost separado, testar
com `sudo nginx -t` e só então recarregar Nginx. Verificar também registos A/AAAA
existentes; um AAAA antigo pode enviar visitantes para outro servidor.
Preparar o certificado HTTPS (por DNS challenge se necessário) antes da mudança
definitiva do DNS e antes de permitir logins públicos. Os cookies de sessão são
Secure e precisam de HTTPS. As credenciais do DNS não pertencem ao repositório.

## Backup e reversão

Fazer cópia diária do volume completo para outro local seguro. Parar o serviço
durante a cópia ou usar o backup online SQLite; copiar apenas `book.sqlite`
enquanto há escritas pode perder alterações no WAL. Incluir `uploads/` e guardar
separadamente `.env.vps`. Testar a restauração regularmente.

Manter o Sites e a exportação original até confirmar a migração. Se houver erro,
parar escritas na VPS e reverter o DNS; reconciliar alterações feitas na VPS antes
de reabrir a origem. Não executar `docker compose down -v`, pois remove o volume.

## Validação do runtime

`node deploy/test-runtime.mjs` verifica migrações, persistência, consultas Drizzle,
transações com rollback, armazenamento de imagens e rejeição de caminhos externos.
