-- ============================================================
-- VS Louvor — Igreja Amor e Vida
-- Consultas de usuários cadastrados no Appwrite
-- Versão V110 | 2026
-- ============================================================
-- COMO USAR:
-- 1) Acesse o Console do Appwrite → seu projeto → Overview → Databases
-- 2) Ou via endpoint REST: GET /api/admin/users (ver abaixo)
-- 3) O Appwrite usa banco PostgreSQL internamente.
--    Se tiver acesso direto ao banco (Appwrite self-hosted),
--    rode estas queries diretamente.
-- Para Appwrite Cloud, use a REST API (seção ENDPOINTS REST abaixo).
-- ============================================================


-- ============================================================
-- 1. TODOS OS USUÁRIOS CADASTRADOS
--    Lista nome, e-mail, data de criação e último acesso.
-- ============================================================
SELECT
    u."$id"           AS id,
    u.name            AS nome,
    u.email           AS email,
    u.status          AS ativo,
    u."emailVerification" AS email_verificado,
    u."$createdAt"    AS criado_em,
    u."$updatedAt"    AS atualizado_em,
    u."accessedAt"    AS ultimo_acesso
FROM
    "users" u
ORDER BY
    u."$createdAt" DESC;


-- ============================================================
-- 2. USUÁRIOS POR PERÍODO DE CADASTRO
--    Substitua as datas conforme necessário.
-- ============================================================
SELECT
    name            AS nome,
    email,
    "$createdAt"    AS criado_em,
    "accessedAt"    AS ultimo_acesso
FROM "users"
WHERE
    "$createdAt" >= '2026-01-01T00:00:00.000Z'
    AND "$createdAt" <= '2026-12-31T23:59:59.999Z'
ORDER BY
    "$createdAt" DESC;


-- ============================================================
-- 3. USUÁRIOS ATIVOS (conta ativa, não bloqueada)
-- ============================================================
SELECT
    name      AS nome,
    email,
    "$createdAt"   AS criado_em,
    "accessedAt"   AS ultimo_acesso
FROM "users"
WHERE status = true
ORDER BY "accessedAt" DESC NULLS LAST;


-- ============================================================
-- 4. USUÁRIOS QUE NUNCA ACESSARAM (cadastraram mas não logaram)
-- ============================================================
SELECT
    name   AS nome,
    email,
    "$createdAt" AS criado_em
FROM "users"
WHERE
    "accessedAt" IS NULL
    OR "accessedAt" = "$createdAt"
ORDER BY "$createdAt" DESC;


-- ============================================================
-- 5. TOTAL DE CADASTROS POR MÊS
-- ============================================================
SELECT
    DATE_TRUNC('month', "$createdAt"::timestamptz)  AS mes,
    COUNT(*)                                         AS total_cadastros
FROM "users"
GROUP BY 1
ORDER BY 1 DESC;


-- ============================================================
-- 6. BUSCA POR NOME OU E-MAIL
--    Substitua '%nome_ou_email%' pelo termo que procurar.
-- ============================================================
SELECT
    "$id"       AS id,
    name        AS nome,
    email,
    status      AS ativo,
    "$createdAt" AS criado_em,
    "accessedAt" AS ultimo_acesso
FROM "users"
WHERE
    LOWER(name)  LIKE LOWER('%david%')
    OR LOWER(email) LIKE LOWER('%david%')
ORDER BY "$createdAt" DESC;


-- ============================================================
-- ENDPOINTS REST (para Appwrite Cloud — sem acesso direto ao DB)
-- Todos requerem a API Key do Render (APPWRITE_API_KEY) no header:
--   x-appwrite-key: SUA_CHAVE
--   x-appwrite-project: 69f4cb460024e484358b
-- ============================================================

-- LISTAR TODOS OS USUÁRIOS (máx 100 por vez):
-- GET https://nyc.cloud.appwrite.io/v1/users?limit=100&offset=0

-- BUSCAR POR E-MAIL:
-- GET https://nyc.cloud.appwrite.io/v1/users?search=david@gmail.com

-- PAGINAÇÃO (próxima página):
-- GET https://nyc.cloud.appwrite.io/v1/users?limit=100&offset=100

-- VIA ENDPOINT DO PRÓPRIO SERVIDOR (mais seguro, API Key fica no servidor):
-- GET https://vs-louvor-avida.onrender.com/api/admin/users
-- GET https://vs-louvor-avida.onrender.com/api/admin/users?search=david
-- GET https://vs-louvor-avida.onrender.com/api/admin/users?limit=50&offset=0

-- LOG DE ACESSOS (quem logou):
-- GET https://vs-louvor-avida.onrender.com/api/admin/access-log
-- GET https://vs-louvor-avida.onrender.com/api/admin/access-log?type=login
-- GET https://vs-louvor-avida.onrender.com/api/admin/access-log?type=register

-- ============================================================
-- FORMATO DA RESPOSTA /api/admin/users
-- ============================================================
-- {
--   "total": 12,
--   "limit": 100,
--   "offset": 0,
--   "users": [
--     {
--       "id": "abc123",
--       "name": "David Antunes",
--       "email": "david.antunes@tridminas.com",
--       "status": true,
--       "emailVerification": false,
--       "createdAt": "2026-05-01T14:23:00.000Z",
--       "updatedAt": "2026-05-27T09:11:00.000Z",
--       "accessedAt": "2026-05-27T09:11:00.000Z",
--       "prefs": { "role": "admin" }
--     }
--   ]
-- }

-- ============================================================
-- FORMATO DA RESPOSTA /api/admin/access-log
-- ============================================================
-- {
--   "count": 45,
--   "entries": [
--     {
--       "type": "login",
--       "userId": "abc123",
--       "name": "David Antunes",
--       "email": "david.antunes@tridminas.com",
--       "at": "2026-05-27T09:11:00.000Z",
--       "ip": "189.xxx.xxx.xxx",
--       "ua": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0...)"
--     },
--     {
--       "type": "register",
--       "name": "Gabriel Santos",
--       "email": "gabriel@igrejaamorevida.com",
--       "at": "2026-05-27T08:45:00.000Z",
--       "ip": "177.xxx.xxx.xxx",
--       "ua": "Mozilla/5.0 (Android 14..."
--     }
--   ]
-- }
