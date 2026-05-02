# Configuração Appwrite — V28B Auth Real

## 1. Projeto

```text
APPWRITE_ENDPOINT=https://nyc.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=69f4cb460024e484358b
```

No Appwrite Console, adicione uma plataforma Web com o domínio do Render:

```text
vs-louvor-avida.onrender.com
```

## 2. Database

```text
Database ID: louvor_avida
Name: Louvor Ávida
```

## 3. Collections necessárias

### app_state

```text
Collection ID: app_state
Name: App State
```

Attributes:

```text
key       string  tamanho 100     obrigatório
value     string  tamanho 100000  obrigatório
updatedAt string  tamanho 40      opcional
updatedBy string  tamanho 255     opcional
```

### user_state

```text
Collection ID: user_state
Name: User State
```

Attributes:

```text
userId    string  tamanho 255     obrigatório
key       string  tamanho 100     obrigatório
value     string  tamanho 100000  obrigatório
updatedAt string  tamanho 40      opcional
userName  string  tamanho 255     opcional
```

## 4. API Key

Crie uma API Key no Appwrite com permissões de leitura e escrita para Databases/Documents.

## 5. Variáveis no Render

```text
GOOGLE_DRIVE_API_KEY=sua_chave_google
APPWRITE_ENDPOINT=https://nyc.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=69f4cb460024e484358b
APPWRITE_DATABASE_ID=louvor_avida
APPWRITE_API_KEY=sua_api_key_do_appwrite
APPWRITE_APP_STATE_COLLECTION_ID=app_state
APPWRITE_USER_STATE_COLLECTION_ID=user_state
```

## 6. O que fica online nesta V28B

- Login real via Appwrite Auth
- Repertórios compartilhados em app_state/setlists
- Favoritos por usuário em user_state/favorites

A biblioteca de músicas continua vindo do Google Drive.


## V31 — Escala editável e membros

A V31 usa a collection `app_state` para salvar dois estados compartilhados:

```text
members
monthlySchedule
```

Não é necessário criar novas collections para esta versão.

### Permissão de edição da escala

No Render, adicione a variável:

```text
APPWRITE_ADMIN_EMAILS=email1@dominio.com,email2@dominio.com
```

Somente usuários logados com e-mail presente nessa lista verão as listas suspensas e poderão salvar a escala no banco.

### Uso

1. Faça login no sistema com um e-mail autorizado em `APPWRITE_ADMIN_EMAILS`.
2. Abra a guia **Escala**.
3. Selecione os membros nas listas suspensas.
4. Clique em **Salvar escala**.

A lista inicial de membros foi extraída da escala de maio, sem nomes repetidos.

---

## V38 — Multi-mês na escala e endpoint /me

### Chaves de mês

A partir da V38, cada mês da escala fica em uma chave própria do `app_state`:

```text
monthlySchedule:2026-05
monthlySchedule:2026-06
monthlySchedule:2026-07
...
```

A chave antiga `monthlySchedule` (sem `:YYYY-MM`) continua sendo lida em modo de compatibilidade para Maio/2026, mas novas gravações vão sempre para `monthlySchedule:2026-05`. **Não é necessário fazer nenhuma migração manual** — basta abrir a escala de Maio/2026 logado como admin e clicar em **Salvar escala** uma vez. O sistema gravará na chave nova.

### Endpoint /api/appwrite/me

Em V38 o servidor não expõe mais a lista de e-mails de administradores. Em vez disso, o cliente faz uma chamada autenticada (com JWT) a `/api/appwrite/me`, que devolve apenas:

```json
{
  "id": "abc123",
  "email": "voce@exemplo.com",
  "name": "Seu Nome",
  "isAdmin": true
}
```

Isso evita que qualquer pessoa visitando o site descubra quem são os administradores apenas inspecionando o tráfego.

### Endpoint admin separado

Operações de admin agora vão por uma rota distinta:

```text
PUT /api/appwrite/admin/state/:key   — exige JWT de admin (members, monthlySchedule:YYYY-MM)
PUT /api/appwrite/state/:key         — exige JWT de qualquer usuário (setlists)
```

Ambos validam **no servidor** que a chave faz sentido para o tipo de operação.
