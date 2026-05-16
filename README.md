# VS Louvor — Igreja Amor e Vida — V96 Performance pack (todas otimizações grátis)

## O que entra na V96

### Resumo de impacto
- Páginas/CSS/JS: **~80% menos tráfego** (gzip).
- Paletas de roupa: **27 MB → 1,4 MB** total (WebP -95%).
- Indexação da biblioteca: **N requests sequenciais → 1 request com cache no servidor**.
- Primeira chamada ao Drive: **~200–400 ms a menos** (preconnect).
- Servidor pode ficar acordado 24/7 sem upgrade (instruções de keep-alive).

### 1) Compressão gzip/brotli (`compression` middleware)
- Adicionada dependência `compression@1.7.4`.
- HTML, CSS, JS, JSON e SVG agora trafegam comprimidos automaticamente.
- Medição local: `styles.css` 197KB → 34KB (-83%), `app.js` 149KB → 35KB (-76%).
- Áudios não são comprimidos (já são formato comprimido).

### 2) WebP para paletas e heroes (com fallback PNG)
- Convertidas as 14 paletas de cor (`palette-1.png` a `palette-14.png`) para WebP com qualidade 82.
- Tamanhos: cada paleta caiu de ~2 MB para ~100 KB.
- HTML usa `<picture><source type="image/webp"><img ...PNG fallback></picture>` — navegador moderno baixa só o WebP, navegador antigo cai no PNG.
- Heroes da página inicial (`hero-blue-cross.png`, `hero-warm-cross.png`) convertidos também, usando CSS `image-set()` para o `background-image`.
- Os arquivos `.png` originais foram **mantidos** para o link "Abrir imagem" (que oferece a paleta full-quality para download/print) e como fallback.

### 3) Endpoint `/api/library` consolidado com cache no servidor
- Antes: o cliente fazia N chamadas sequenciais a `/api/drive` (uma por subpasta), recursivamente. Em biblioteca com 30 cantores, isso virava ~50 requests em série.
- Agora: o servidor varre o Drive uma vez, monta o catálogo completo, cacheia em memória por **30 minutos**, e devolve tudo em **um único request**.
- O endpoint paraleliza até 4 subpastas simultâneas, reduzindo o tempo de build em si.
- O cliente tenta `/api/library` primeiro; se falhar (offline, erro), faz fallback automático para o método progressivo antigo.
- Para forçar rebuild: `GET /api/library?rootId=...&force=1`.
- Header `X-Library-Cache: hit|miss|stale-on-error` para debug.

### 4) Preconnect e dns-prefetch
- Adicionados no `<head>` para `googleapis.com`, `drive.google.com`, `lh3.googleusercontent.com` e `fra.cloud.appwrite.io`.
- O navegador resolve DNS e abre TLS em paralelo com o parse do HTML.
- Ganho típico: 200–400ms na primeira chamada a cada um desses serviços.

### 5) Endpoint `/healthz` para keep-alive
- `GET /healthz` retorna JSON pequeno com status do servidor e idade do cache da biblioteca.
- Use isso para **manter o serviço acordado no plano free do Render** (que dorme depois de 15min sem tráfego).

#### Configurando keep-alive grátis no cron-job.org
1. Crie conta grátis em https://cron-job.org
2. Crie um job:
   - URL: `https://vs-louvor-avida.onrender.com/healthz`
   - Schedule: a cada 14 minutos
   - Failure notification: opcional
3. Salve. Pronto — o servidor não dorme mais.

Alternativa: UptimeRobot grátis (50 monitores, intervalo mínimo 5 min) em https://uptimerobot.com

### Mudanças menores
- Versão do Service Worker bumpada para `v96.0.0` (força refresh automático nos celulares).
- Header `Vary: Accept-Encoding` adicionado automaticamente pelo middleware de compressão (necessário para caches HTTP funcionarem corretamente).

---

# Versão anterior — V95 Modais sem corte no celular

## O que entra na V95

### Modal "Alterar tom" no celular
- Antes: em telefones, o modal estourava a altura da tela e cortava no meio do botão "Ouvir no tom original", de forma que "Baixar tom original" ficava invisível.
- Agora o `.modal-card` é um flex column onde só a grid das 12 tonalidades scrolla. O bloco de ações ("Ouvir neste tom", "Baixar neste tom", "Adicionar ao repertório neste tom") fica fixo no rodapé do card, sempre visível, com separador discreto.
- Padding inferior reservado para o player foi reduzido — o `max-height` do card já garante que ele não fica atrás do mini-player.
- Tipografia e info-strips do header ficaram mais compactos no mobile para sobrar espaço para os botões.
- Em paisagem (`max-height: 560px`), o título encolhe e os info-strips somem para garantir a visibilidade dos botões.

### Modal "Detalhes da música" no celular
- Mesma proteção flex-column com ações fixas no rodapé.
- Adicionado botão **⤓ Baixar tom original** entre "Tocar agora" e "Alterar tom".
- A capa quadrada virou retangular com `max-height: 32svh` para não comer a tela.
- As 5 ações ficam em grid 2 colunas no mobile, com "Tocar agora" ocupando a linha inteira no topo.

---

# Versão anterior — V94 PWA mobile + cache de áudios + card otimizado

## O que entra na V94

### 1) Cache offline das músicas no celular (PWA)
- Novo arquivo `sw.js` (Service Worker) com 3 estratégias de cache:
  - **Shell** (HTML/CSS/JS/manifest/logo): stale-while-revalidate.
  - **Áudios** (`/api/audio/:id` e arquivos .mp3/.m4a etc): cache-first com LRU de até 300 músicas.
  - **APIs do Appwrite e listagem do Drive**: network-first com fallback ao cache (abre offline).
- Após o primeiro acesso, as músicas tocam direto do disco do celular — sem rebaixar.
- `manifest.json` torna o sistema instalável como app na tela inicial (Android e iOS).
- `index.html` agora registra o SW automaticamente e tem `theme-color` + `apple-touch-icon`.

### 2) Pré-carregamento priorizado por repertório
- Ao abrir a biblioteca, as músicas que estão em **qualquer repertório** aparecem primeiro na grid.
- Em segundo plano, o SW recebe um `postMessage('PRECACHE_AUDIOS', urls)` e baixa silenciosamente até 60 músicas dos repertórios — respeitando `saveData` e conexões 2G.
- Quando um repertório é criado, editado ou recebe uma música nova, o pré-cache é refeito automaticamente.

### 3) Desduplicação da biblioteca
- `dedupeTracksById()` aplica `Set` por `track.id` em todo carregamento (cache local, indexação inicial e refresh em background).
- Acaba o problema de músicas repetidas quando a indexação reentrava.

### 4) Cards de música redesenhados para mobile
- Card ocupa quase a tela inteira no celular (`min-height: calc(100svh - 220px)`).
- Capa quadrada grande no topo, ideal para o ensaio/culto onde o ministro precisa identificar a música de longe.
- Nova linha de ações de 6 botões na mesma fileira: **Tocar | Baixar | Tom | Favoritar | + | ⋯**
- Botão **Baixar (⤓)** agora vive no próprio card e funciona sempre, mesmo no tom original (antes só existia dentro do modal de tom).
- Botões com altura reduzida (42px no mobile, 40px em telas <380px) para caberem em uma linha.
- Ícone "+" do repertório centralizado corretamente (correção de off-center).

### 5) Headers de cache no backend
- `/api/audio/:id` retorna `Cache-Control: public, max-age=2592000, immutable` quando não é range request — assim o SW (e o navegador) podem guardar o áudio inteiro.
- Range requests (206) continuam com `Cache-Control: no-store` para não corromper o cache com fatias parciais.
- `/sw.js` é servido com `Cache-Control: no-cache` para que atualizações cheguem ao celular imediatamente.

### Notas operacionais
- O cache de áudios tem teto de **300 entradas** por dispositivo (~1–1.5 GB típico). Quando passa, o SW remove as entradas mais antigas (FIFO simples).
- O usuário pode forçar refresh apertando "Atualizar biblioteca" (já existia) — isso limpa o cache do Drive em localStorage, mas não o cache de áudios. Para limpar áudios, é possível enviar `postMessage('CLEAR_AUDIO_CACHE')` ao SW (futuro botão de configuração).
- O Service Worker só funciona em **HTTPS** ou `localhost`. No Render isso já é HTTPS por padrão.

---

# Histórico anterior — V19 Tom alterado visível + textos padronizados

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


## V46

- carregamento progressivo das músicas do Google Drive
- acesso liberado antes do fim da indexação completa
- uso de cache local para abertura quase imediata nas próximas visitas
- atualização do Drive em segundo plano
- nova tela de carregamento com visual mais impactante e progresso de indexação


## V48

- repertórios continuam compartilhados no Appwrite (`app_state/setlists`)
- usuários comuns podem criar repertórios
- usuários comuns podem adicionar músicas e reordenar repertórios
- usuários comuns podem editar repertórios
- apenas administradores/líderes configurados em `APPWRITE_ADMIN_EMAILS` podem excluir repertórios


## V49

- em smartphones, a Biblioteca usa somente a visualização por **Detalhes**
- botão **Miniaturas** oculto no mobile
- cards das músicas no celular ficam compactos, legíveis e mais rápidos de navegar


## V51

- nova guia **Histórico**
- registro de músicas tocadas
- ranking de músicas mais tocadas
- ranking de tons mais usados
- últimas atividades
- botão **Notificar** nos repertórios
- notificações internas e tentativa de notificação do navegador quando permitida


## V52

- removido o ícone de play no hover da miniatura das músicas
- botões de tocar passam a exibir apenas o ícone de play
- acessibilidade mantida com aria-label e title nos botões de reprodução


## V53

- correção do layout dos botões das músicas no smartphone
- labels centralizados e redimensionados
- grid dos botões reorganizado para melhor leitura e toque


## V54

- refinamento premium dos botões das músicas no smartphone
- centralização total dos ícones e labels
- tamanhos e alturas padronizados
- melhor leitura para labels como Favoritar, Tom, Repertório e Detalhes
- botão principal de play mais limpo e equilibrado


## V55

- biblioteca mobile com visual mais parecido com app nativo
- cards das músicas mais premium no smartphone
- hero e estatísticas refinados no mobile
- player mobile polido com melhor proporção, espaçamento e safe-area
- dock inferior mobile com acabamento mais elegante


## V56

- login mobile refinado com melhor proporção, campos e ações
- escala mobile mais nítida e organizada
- repertórios mobile mais limpos e fáceis de editar
- botões e listas com melhor toque e leitura no celular


## V57

- corrigido erro Appwrite `Missing required attribute "user_id"` ao salvar favoritos
- backend agora salva `user_state` usando os atributos corretos: `user_id`, `key`, `value`, `updated_at`
- centralização reforçada dos ícones de play nos botões de música, repertório e player principal


## V58

- correção do artefato visual/transparência nas miniaturas ao passar o mouse nos filtros da biblioteca
- remoção do brilho translúcido que interferia visualmente nas capas
- isolamento de camadas entre filtros e cards de músicas


## V59

- corrigida a detecção do tom original das músicas
- o sistema agora prioriza o tom indicado ao final do nome do arquivo, como `Nome da música - D.mp3`
- evita falso positivo com títulos que começam com A, B, C etc.
- cache da biblioteca foi atualizado para forçar nova leitura dos tons


## V60

- repertórios ficam disponíveis para todos os usuários
- somente o usuário que criou o repertório pode editá-lo ou excluí-lo
- repertórios exibem o criador
- repertórios de outros usuários abrem em modo leitura
- tons exibidos com nome por extenso: `C (dó)`, `D# (ré sustenido)`, etc.


## V61

- ao clicar no card do repertório, abre a janela do repertório em formato de playlist
- modal do repertório com texto e apresentação mais claros
- botão do card usa a linguagem Playlist


## V62

- após criar um repertório, o sistema redireciona automaticamente para a Biblioteca
- novo banner “Repertório ativo” na Biblioteca
- cards de música passam a mostrar o botão “+ Adicionar a este repertório” quando houver repertório ativo
- botão “Ver repertório” no banner
- botão “Concluir repertório” no banner
- repertório ativo salvo temporariamente no navegador até o usuário concluir


## V63

- na janela da playlist, novo botão “Adicionar música” que ativa o repertório e leva de volta à Biblioteca
- botão de repertório nos cards fica apenas com ícone
- texto “Adicionar ao repertório” aparece somente como efeito/tooltip ao passar o mouse ou focar o botão


## V64

- destaque visual para músicas que já estão no repertório ativo
- banner do repertório ativo com contador mais claro
- feedback visual com animação ao adicionar música ao repertório
- ícone do repertório mostra check quando a música já faz parte do repertório ativo


## V65

- removida a escrita “Modo Louvor Premium” do player de música.


## V71

- correção robusta da navegação por guias
- cada guia exibe somente seu próprio conteúdo
- correção de overflow para impedir seções saindo do painel central
- nova guia Paleta de Cores isolada de Repertórios e Histórico


## V72

- link compartilhado de repertório abre somente o modal/playlist do repertório
- não inicia mais o player automaticamente ao abrir `?setlist=...`
- a guia Início permanece ao fundo quando o repertório é aberto por link compartilhado


## V76

- correção da exportação de arte do repertório em PNG
- botão Exportar arte agora gera o arquivo para download
- fallback de download quando o compartilhamento nativo do navegador não estiver disponível
- a arte inclui nome do repertório, músicas, tons, paleta e identidade Igreja Amor e Vida


## V79

- botão de atualizar agora força uma nova leitura do Google Drive
- limpeza automática de caches antigos da biblioteca (`vs_drive_cache_*`)
- útil quando novas músicas são adicionadas ao Drive e ainda não aparecem no sistema


## V80

- login mais rápido, principalmente em smartphone
- carregamento da biblioteca passa a iniciar depois da sessão do usuário, evitando bloquear a tela de login
- tela de loading começa oculta e aparece apenas quando necessário
- recuperação de senha corrigida com fluxo de confirmação usando `userId` e `secret` do Appwrite
- nova área para redefinir senha quando o usuário abre o link enviado por e-mail


## V81

- modal da playlist passa a ter rolagem interna e margem de segurança para não ficar atrás do player
- layout mobile da playlist ajustado para rolar todas as músicas do repertório
- botões de play dentro da playlist dão resposta visual imediata e fazem pré-aquecimento da conexão com o Drive
- tela de loading personalizada fica visível logo ao abrir o sistema e vira aviso discreto quando a biblioteca carrega em segundo plano


## V82

- corrigido problema no smartphone em que a lista de músicas voltava para o topo durante a rolagem
- removido re-render automático em qualquer resize do navegador mobile
- preservação de posição de rolagem quando a biblioteca precisa ser redesenhada


## V83

- playlist no smartphone com modal mais alto e área útil maior
- rolagem interna da lista de músicas do repertório corrigida
- player mobile mais compacto para não cobrir as músicas
- últimas músicas do repertório continuam acessíveis mesmo com o player aberto


## V84 — UX Mobile Pro

- fluxo de criação de repertório com feedback mais claro
- barra compacta de repertório ativo no mobile
- cards de música mobile reorganizados com labels visíveis
- player mobile mais compacto
- filtros transformados em bottom sheet no smartphone
- escala mobile em cards, sem tabela
- feedbacks/toasts melhorados
- estados vazios mais orientativos
- linguagem padronizada para Repertórios, Biblioteca, Escala e Paletas


## V85

- texto “Refinamento” trocado por “Filtros da Biblioteca” na seção Biblioteca.
- título “Filtros inteligentes” simplificado para “Filtros”.


## V86

- botão **Fechar** do player recolocado e fixado no smartphone.
- ajuste de posição, tamanho e contraste do botão no player mobile.


## V87

- filtros no mobile retornaram ao modelo antigo, fixos na página
- repertórios no smartphone abrem a playlist ao tocar no card ou no botão Playlist
- cards de músicas mobile ficaram mais limpos e menos espremidos
- removida duplicidade visual do botão play
- player mobile restaurado com botão fechar, volume e barra de progresso
- área da playlist ganhou margem/rolagem para não ficar atrás do player


## V88

- cards das músicas dentro do repertório mostram apenas nome da música e tom escolhido
- removidas informações extras como cantor/pasta dentro da playlist
- cards do repertório ficaram maiores e mais legíveis
- tom original ou alterado aparece em destaque


## V89 — Performance rápida

- busca com debounce para reduzir processamento a cada tecla
- endpoint backend `/api/appwrite/bootstrap/:userId` para carregar setlists, favoritos, escala, membros e histórico em uma única chamada
- fallback automático para chamadas separadas caso o bootstrap falhe
- imagens de paletas com `loading=lazy` e `decoding=async`
- `content-visibility:auto` nos cards para melhorar scroll em listas grandes
- correção do resize mobile para evitar re-render e salto de rolagem
