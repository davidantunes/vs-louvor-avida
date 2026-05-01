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
