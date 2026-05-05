# VS Louvor — Igreja Amor e Vida — V19 Tom alterado visível + textos padronizados

## O que entra na V10

### 1) Drag and drop nos repertórios
- abra um repertório
- arraste as músicas para reordenar
- remova faixas individualmente
- toque o repertório inteiro

### 2) Ordenação manual do repertório
- a ordem salva no navegador do usuário
- útil para montar culto e ensaio na sequência correta

### 3) Mini tela individual da música
- detalhes da música
- tags inteligentes
- ações rápidas: tocar, favoritar, alterar tom e compartilhar

### 4) Tema claro / escuro
- alternância por botão no topo
- preferência salva em localStorage

### 5) Deploy pronto no Render
- incluído `render.yaml`
- `npm start` já configurado
- backend Node + Express + FFmpeg pronto

---

## Como rodar localmente

```bash
npm install
npm start
```

Abra:

```text
http://localhost:3000
```

---

## Deploy no Render

### Opção rápida
1. envie esta pasta para um repositório no GitHub
2. no Render, clique em **New +** → **Web Service**
3. conecte o repositório
4. o Render deve ler automaticamente o `render.yaml`
5. adicione a variável de ambiente:

- `GOOGLE_DRIVE_API_KEY` = sua chave da API do Google Drive

### Configuração manual
- **Environment**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`

---

## Observações
- os favoritos, repertórios e tema ficam salvos em `localStorage`
- a biblioteca é lida do Google Drive configurado em `config.js`
- o backend usa FFmpeg para gerar o áudio transposto no tom escolhido


## Novidades da V10

### Visualização por miniatura ou detalhes
- botão **Miniaturas**
- botão **Detalhes**
- a preferência fica salva no navegador

### Carregamento progressivo
- no modo Miniaturas, carrega menos músicas por vez para manter o visual leve
- no modo Detalhes, carrega mais músicas por vez
- conforme o usuário rola a página, novas músicas são carregadas automaticamente

### Benefícios
- melhor performance com bibliotecas grandes
- visual mais limpo
- navegação mais fluida no celular e no computador


## Novidades da V11

### Seleção de tom por escala musical
Agora o modal de alteração de tom mostra a escala:

```text
C C# D D# E F F# G G# A A# B
```

Em vez de escolher `+1`, `-2`, etc., o usuário escolhe diretamente o **novo tom desejado**.

### Tom original e novo tom
A janela mostra:

- **Tom original**
- **Novo tom escolhido**

Exemplo:

```text
Tom original: D
Novo tom: F
```

O sistema calcula automaticamente a transposição necessária.

### Observação
Para o sistema detectar corretamente o tom original, o ideal é que o arquivo tenha o tom no nome, por exemplo:

```text
A Ele a Glória - D.mp3
Bondade de Deus - C#.mp3
Aclame ao Senhor - G.mp3
```


## Novidades da V12

### Tom alterado salvo somente no repertório
Se o usuário alterar o tom da música e adicionar ao repertório, o repertório salva aquela música com o tom escolhido.

Isso **não altera o tom original da música na biblioteca**.

Exemplo:

- Biblioteca: `A Ele a Glória - D`
- Repertório Domingo: `A Ele a Glória - F`
- Repertório Jovens: `A Ele a Glória - E`

A mesma música pode existir em vários repertórios com tons diferentes.

### Como usar
1. Clique em **Tom** na música
2. Escolha o novo tom na escala
3. Clique em **+ Repertório neste tom**
4. Escolha ou crie o repertório

Ao tocar o repertório, o sistema usa o tom salvo naquele repertório.


## Novidades da V13

- capas das músicas padronizadas com a **logo da Igreja Amor e Vida**
- remoção das letras no centro das miniaturas
- hero/banner com fundo mais emocional e refinado
- citação bíblica sobre louvor no card lateral
- nova guia **Tutorial** com passo a passo de uso do sistema


## Novidades da V14

- hero/banner mais cinematográfico
- cards de música mais sofisticados
- tutorial em acordeão
- tour guiado automático na primeira abertura
- botão para reiniciar o tour
- menu mobile ajustado para 5 abas


### Ajuste extra
- setas visíveis de **próximo** e **anterior** no tour guiado


## Novidades da V15

- remoção do título **VS Louvor Premium** do card lateral
- nova frase institucional no hero
- **bolinhas de progresso** no tour
- **spotlight/highlight** escurecendo o restante da tela
- **card do tour reposicionado dinamicamente** conforme o elemento destacado
- opção **Não mostrar novamente** no tour


## Novidades da V16

- nome final do sistema: **Biblioteca de Louvor — Igreja Amor e Vida**
- **tela de login institucional** com nome e equipe/escala
- **loading screen profissional**
- **ícones premium** na navegação e ações principais
- **microanimações** e acabamentos visuais refinados
- favicon e estrutura prontos para publicação no Render

### Observação

A tela de login da V16 é uma camada de experiência/local no navegador. Para autenticação real por usuário, o próximo passo ideal é integrar Supabase Auth ou Firebase Auth.


## Novidades da V17

- **tour corrigido** para ficar acima de toda a interface
- setas do tour agora ficam clicáveis, sem serem cobertas por outros elementos
- **guia rápido movido para a sidebar** para um visual mais limpo
- **guia completo em modal**, acessível pela sidebar e pelo mobile
- ajustes de layout da sidebar para acomodar o novo guia


## Novidades da V19

- o modal de alteração de tom agora mostra **Tom original** e **Tom alterado**
- ao escolher um novo tom, o campo **Tom alterado** é atualizado imediatamente
- a janela de detalhes da música mostra **Tom original** e **Tom alterado**
- repertórios preservam o tom alterado somente dentro da lista, sem alterar a música original
- textos de botões, mensagens e rótulos foram padronizados para uma linguagem mais institucional


## Novidades da V19

- nova guia **Escala** no menu lateral
- seção **Escala Louvor Ávida — Maio 2026**
- tabela interativa com filtros por pessoa, dia e função
- botão para imprimir a escala
- observações e horários de ensaio integrados ao sistema
- visual no mesmo padrão premium do restante da plataforma


## Ajuste V20 — comportamento do player

- ao terminar uma música, o player **para**
- o sistema **não avança automaticamente** para a próxima música
- o sistema **não repete automaticamente** a música
- o botão de repetição agora funciona como **reiniciar música atual**


## Novidades da V22

- Navegação lateral transformada em **páginas internas**.
- Ao clicar em **Escala**, aparece somente a escala.
- Ao clicar em **Repertórios**, aparecem somente os repertórios.
- Ao clicar em **Biblioteca**, aparecem somente filtros e músicas.
- Ao clicar em **Início**, aparecem somente banner e indicadores principais.
- Player mantém uma página própria e o controle inferior continua disponível.


## Novidades da V22

- guia **Player** removida da sidebar e do menu mobile
- player inferior fica oculto ao abrir o sistema
- player aparece somente depois que o usuário clicar para tocar uma música
- botões de controle do player foram centralizados visualmente
- ao terminar uma música, o sistema permanece parado, sem avançar automaticamente


## Novidades da V23

- conteúdo do guia de uso movido para a página **Tutorial**
- sidebar agora mantém apenas o botão **Iniciar Tour**
- a guia Tutorial passa a funcionar como página interna, igual Biblioteca, Escala e Repertórios
- removido o botão **Abrir guia** da sidebar


## Correção V24

- tour agora muda automaticamente para a página correta ao clicar em **Anterior** ou **Próximo**
- o destaque rola até a área correta antes de posicionar o card
- setas do tour centralizadas corretamente dentro dos círculos
- tour permanece acima de toda a interface


## Correção V26

- botão principal de Play/Pause redesenhado com ícones CSS centralizados
- removidos caracteres de texto desalinhados no botão circular
- alinhamento preservado em desktop e mobile


## Novidades da V26 — Responsividade

- revisão de layout para desktop, notebook, tablet e celular
- sidebar otimizada em notebooks e substituída por dock mobile em telas menores
- player inferior ajustado para mobile e tablets
- tabelas da escala com rolagem horizontal segura
- modais adaptados para telas pequenas
- cards, filtros, botões e tutorial ajustados para toque
- correções para celulares muito pequenos e modo paisagem


## V27 Render corrigido

Esta versão corrige o problema em que o navegador exibia o conteúdo do `app.js` como texto.

Arquivos que precisam estar corretos na raiz do GitHub:

- `index.html` deve começar com `<!doctype html>`
- `app.js` deve começar com `const cfg = window.VS_LOUVOR_CONFIG;`
- `package.json` deve ser JSON válido
- `server.js` deve ser código JavaScript Node/Express

No Render, configure a variável `GOOGLE_DRIVE_API_KEY`.


## V28B — Appwrite Auth Real

Esta versão adiciona autenticação real pelo Appwrite Auth.

Também inclui integração inicial de banco online:

- repertórios compartilhados no Appwrite
- favoritos por usuário no Appwrite
- fallback local caso o Appwrite ainda não esteja configurado

Consulte `APPWRITE_SETUP.md` antes de publicar no Render.


## V29 — Escala de Maio 2026

- Dados da escala de maio adicionados a partir do arquivo enviado.
- Guia Escala atualizada com os nomes, datas, funções e observações exatamente no padrão da planilha.
- Filtros e impressão preservados.


## Novidades da V30

- Escala de Maio 2026 preenchida com as pessoas exatamente nas datas e funções do arquivo Excel enviado.
- Mantidos filtros de pessoa, dia e função na guia Escala.
- Mantidas observações e horários de ensaio do arquivo original.


## V32 — Escala editável com membros no Appwrite

- Lista de membros criada a partir da escala de maio, sem repetir nomes.
- A escala agora pode ser editada com listas suspensas.
- Somente usuários com e-mail cadastrado em `APPWRITE_ADMIN_EMAILS` no Render podem editar.
- Os dados são salvos no Appwrite em `app_state/members` e `app_state/monthlySchedule`.


## Novidades da V32

- layout da tabela da escala atualizado e mais alinhado ao padrão visual atual
- página inicial de autenticação reforçada
- criação de cadastro com e-mail/senha no Appwrite Auth sem entrar automaticamente
- após cadastrar, o usuário volta para o fluxo de login para acessar sua conta
- usuários comuns continuam em modo leitura e não podem alterar a escala
- apenas e-mails listados em APPWRITE_ADMIN_EMAILS podem editar a escala


## Novidades da V35

- alternância refinada entre Entrar e Criar cadastro
- confirmação de senha no cadastro
- botão mostrar/ocultar senha para senha e confirmação
- opção visual de lembrar sessão neste dispositivo
- recuperação de senha por e-mail via Appwrite Auth
- avatar com iniciais do usuário
- painel de perfil com dados da conta, permissão, favoritos e repertórios


## V38

- tela de login simplificada
- modo Entrar mostra apenas **e-mail** e **senha**
- modo Criar cadastro mostra apenas **nome**, **e-mail** e **senha**
- campo **Equipe / escala** removido
- tela de acesso sem redundância visual


## V39

- corrigida integração com Appwrite para usar os atributos esperados nas collections:
  - app_state: `key`, `value`, `updated_at`
  - user_state: `user_id`, `key`, `value`, `updated_at`
- removidos campos não cadastrados no Appwrite, como `updatedAt`, `updatedBy`, `userId` e `userName` no payload gravado.


## V40

- campo **Nome** oculto no modo **Entrar**
- campo **Nome** exibido somente em **Criar cadastro**
- correção global da classe `hidden` para evitar exibição indevida


## V41

- removido o filtro **Função** da página **Escala**
- a busca feita na página inicial agora redireciona automaticamente para **Biblioteca**
- quando não houver resultado, a mensagem aparece já na página **Biblioteca**


## V42

- botão **Reproduzir aleatório** agora inicia reprodução contínua aleatória
- ao terminar uma música, outra música aleatória é iniciada automaticamente
- esse comportamento só fica ativo quando iniciado pelo botão **Reproduzir aleatório**
- ao escolher uma música manualmente, o player volta ao comportamento normal


## V43

- correção definitiva do campo **Nome**: oculto no modo **Entrar** e visível somente em **Criar cadastro**
- reforço via CSS e JavaScript para evitar cache/ordem de estilos exibindo o campo indevidamente
- mantém o comportamento de reprodução aleatória contínua da V42


## V45

- acabamento premium no mobile
- escala mais elegante e legível no celular
- repertórios em cards mais limpos no mobile
- player mobile mais compacto e refinado
- melhorias para celular em modo paisagem
