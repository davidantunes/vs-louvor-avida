
const cfg = window.VS_LOUVOR_CONFIG;
const GOOGLE_API = 'https://www.googleapis.com/drive/v3/files';
const audioExt = ['mp3','wav','m4a','aac','ogg','flac','wma'];
const imageExt = ['jpg','jpeg','png','webp'];
const CHROMATIC_KEYS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT_TO_SHARP = { DB:'C#', EB:'D#', GB:'F#', AB:'G#', BB:'A#' };

let allTracks = [];
let current = null;
let currentQueue = [];
let currentIndex = -1;
// V123 — true enquanto o usuário está arrastando a barra de progresso.
// Evita que o timeupdate do áudio sobrescreva o valor durante o arrasto.
let isUserSeeking = false;
let repeatMode = false;
let shuffleMode = false;
let randomContinuousMode = false;
let selectedSemitone = 0;
let selectedToneLabel = '';
let toneTarget = null;
let setlistTarget = null;
let setlistTargetTone = { semitones: 0, tone: '' };
const ACTIVE_SETLIST_KEY = 'vs_active_setlist_v62';
const PENDING_PALETTE_SETLIST_KEY = 'vs_pending_palette_setlist_v67';
let activeSetlistId = loadJSON(ACTIVE_SETLIST_KEY, '');
let pendingPaletteSetlistId = loadJSON(PENDING_PALETTE_SETLIST_KEY, '');
let pendingPaletteReturnTarget = '';
let pendingPaletteChoice = null;
let pendingPaletteShareSetlistId = '';
let currentSetlistDetailId = null;
let sharedSetlistContextId = null;
let songModalTarget = null;
let favorites = loadJSON('vs_favorites_v1', []);
let setlists = loadJSON('vs_setlists_v1', []);
let usageHistory = loadJSON('vs_usage_history_v51', []);
let appwriteClient = null;
let appwriteAccount = null;
let authUser = null;
let authMode = "login";
let cloudReady = false;
let isFavoritesFilter = false;
let viewMode = loadJSON('vs_view_mode_v10', 'thumbnails');
let filteredTracksCache = [];
let renderedCount = 0;
const PAGE_SIZE = {
  thumbnails: 12,
  details: 24
};
const LOAD_MORE_SIZE = {
  thumbnails: 8,
  details: 18
};

const DEFAULT_scheduleRows = [
  { day:'Domingo', date:'03/05', minister:'Rayssa', back1:'Ana Caroline', back2:'Edimar', back3:'Caroline', bass:'Pr Douglas', drums:'Daniel', guitar:'Alessandro', keyboard:'Douglas', sound:'Edvanio' },
  { day:'Quinta', date:'07/05', minister:'Thelma', back1:'Marcia', back2:'Luis', back3:'Letícia', bass:'Pr Douglas', drums:'Daniel', guitar:'Alessandro', keyboard:'Douglas', sound:'Antônio' },
  { day:'Domingo', date:'10/05', minister:'Laryssa', back1:'Dafnis', back2:'Thiagão', back3:'Ludmilla', bass:'Marcinho', drums:'', guitar:'Alessandro', keyboard:'Thiago Matos', sound:'Edvanio' },
  { day:'Quinta', date:'14/05', minister:'Izabel', back1:'Márcia', back2:'Daniele', back3:'Letícia', bass:'Luis', drums:'Mayra', guitar:'Fábio', keyboard:'Douglas', sound:'Edmilson' },
  { day:'Domingo', date:'17/05', minister:'Caroline', back1:'Mariah', back2:'Leandro', back3:'Tales', bass:'Luis', drums:'Daniel', guitar:'Alessandro', keyboard:'Douglas', sound:'Edvanio' },
  { day:'Quinta', date:'21/05', minister:'Laryssa', back1:'Thelma', back2:'Edimar', back3:'Daniele', bass:'Pr Douglas', drums:'Daniel', guitar:'Alessandro', keyboard:'Douglas', sound:'Antônio' },
  { day:'Domingo', date:'24/05', minister:'Luis', back1:'Rayssa', back2:'Leandro', back3:'Leticia', bass:'Fábio', drums:'Mayra', guitar:'Alessandro', keyboard:'Douglas', sound:'Edvanio' },
  { day:'Quinta', date:'28/05', minister:'Márcia', back1:'Thelma', back2:'Thiagão', back3:'Daniele', bass:'Pr Douglas', drums:'Mayra', guitar:'Alessandro', keyboard:'Douglas', sound:'Edmilson' },
  { day:'Domingo', date:'31/05', minister:'Dafnis', back1:'Izabel', back2:'Edimar', back3:'Tales', bass:'Pr Douglas', drums:'Daniel', guitar:'Fábio', keyboard:'Thiago Matos', sound:'Edvanio' }
];

// V112 — Escala de Junho 2026 (importada do Excel Escala_Louvor_Junho_2026.xlsx)
const JUNHO_2026_ROWS = [
  { day:'Quinta', date:'04/06', minister:'Rayssa', back1:'Daniele', back2:'Edimar', back3:'Ludmilla', bass:'Luis', drums:'Daniel', guitar:'Alessandro', keyboard:'Douglas', sound:'Pr Douglas' },
  { day:'Domingo', date:'07/06', minister:'Izabel', back1:'Ana Caroline', back2:'Leandro', back3:'Thelma', bass:'Marcinho', drums:'Mayra', guitar:'Fábio', keyboard:'Douglas', sound:'Edvanio' },
  { day:'Quinta', date:'11/06', minister:'Laryssa', back1:'Márcia', back2:'Thiagão', back3:'Mariah', bass:'Pr Douglas', drums:'', guitar:'Alessandro', keyboard:'Douglas', sound:'Antônio' },
  { day:'Domingo', date:'14/06', minister:'Dafnis', back1:'Mariah', back2:'Edimar', back3:'Caroline', bass:'Luis', drums:'Daniel', guitar:'Alessandro', keyboard:'Thiago Matos', sound:'Edvanio' },
  { day:'Quinta', date:'18/06', minister:'Daniele', back1:'Thelma', back2:'Laryssa', back3:'Letícia', bass:'Luis', drums:'Daniel', guitar:'Alessandro', keyboard:'Douglas', sound:'Edmilson' },
  { day:'Domingo', date:'21/06', minister:'Márcia', back1:'Ana Caroline', back2:'Leandro', back3:'Tales', bass:'Marcinho', drums:'Mayra', guitar:'Fábio', keyboard:'Douglas', sound:'Edvanio' },
  { day:'Quinta', date:'25/06', minister:'Luis', back1:'Márcia', back2:'Izabel', back3:'Letícia', bass:'Pr Douglas', drums:'Mayra', guitar:'Fábio', keyboard:'Douglas', sound:'Antônio' },
  { day:'Domingo', date:'28/06', minister:'Thiagão', back1:'Thelma', back2:'Rayssa', back3:'Caroline', bass:'Pr Douglas', drums:'Daniel', guitar:'Alessandro', keyboard:'Douglas', sound:'Edvanio' }
];

// V112 — Estrutura multi-mês: chave "YYYY-MM", valor = array de rows.
// Permite navegação por mês e importação de escalas futuras sem perder as anteriores.
const DEFAULT_ALL_MONTHS = {
  '2026-05': DEFAULT_scheduleRows,
  '2026-06': JUNHO_2026_ROWS
};

let allScheduleMonths = {}; // populado no initSchedule
let activeScheduleMonth = ''; // "YYYY-MM" do mês sendo exibido
const DEFAULT_MEMBERS = ["Alessandro", "Ana Caroline", "Antônio", "Caroline", "Dafnis", "Daniel", "Daniele", "Douglas", "Edimar", "Edmilson", "Edvanio", "Fábio", "Izabel", "Laryssa", "Leandro", "Letícia", "Ludmilla", "Luis", "Márcia", "Marcinho", "Mariah", "Mayra", "Pr Douglas", "Rayssa", "Tales", "Thelma", "Thiagão", "Thiago Matos"];
let scheduleRows = DEFAULT_scheduleRows.map(row => ({...row}));
let members = [...DEFAULT_MEMBERS];
let cloudAdminEmails = [];
let cloudAdminConfigured = false;
let scheduleDirty = false;
const SCHEDULE_ROLE_LABELS = {
  minister: 'Ministro', back1: 'Back', back2: 'Back', back3: 'Back', bass: 'Baixo', drums: 'Bateria', guitar: 'Guitarra', keyboard: 'Teclado', acoustic: 'Violão', sound: 'Tec. Som'
};

let infiniteObserver = null;
let libraryLoadingInBackground = false;
let progressiveRenderTimer = null;
let indexedFolderCount = 0;
let discoveredFolderCount = 0;
let indexedTrackCount = 0;
let firstProgressBatchReleased = false;
let tourStepIndex = 0;
const TOUR_DISABLE_KEY = "vs_guided_tour_disabled_v16";
const TOUR_STORAGE_KEY = "vs_guided_tour_done_v16";
const SESSION_KEY = "vs_user_session_v16";
let libraryLoaded = false;
let libraryLoadStarted = false;
const TOUR_STEPS = [
  { hash: '#inicio', selector: '[data-tour="search"]', title: 'Busca inteligente', description: 'Comece por aqui para encontrar músicas por nome, cantor/pasta, tom, tag ou arquivo.' },
  { hash: '#inicio', selector: '[data-tour="hero"]', title: 'Área principal', description: 'Aqui estão os atalhos mais importantes, indicadores rápidos e acesso ao player aleatório.' },
  { hash: '#biblioteca', selector: '[data-tour="filters"]', title: 'Filtros inteligentes', description: 'Refine a biblioteca por música, tom, tag, tipo de arquivo e favoritas.' },
  { hash: '#biblioteca', selector: '[data-tour="library"]', title: 'Biblioteca de músicas', description: 'Alterne entre Miniaturas e Detalhes e role a tela para carregar mais músicas automaticamente.' },
  { hash: '#repertorios', selector: '[data-tour="setlists"]', title: 'Repertórios por culto', description: 'Crie repertórios, organize a ordem das músicas e compartilhe listas com a equipe.' },
  { hash: '#historico', selector: '[data-tour="history"]', title: 'Histórico e notificações', description: 'Veja músicas mais tocadas, tons usados, atividades recentes e notificações de repertório.' },
  { hash: '#tutorialPage', selector: '[data-tour="tutorial"]', title: 'Guia de uso', description: 'Sempre que quiser, volte aqui para rever instruções e iniciar novamente o tour guiado.' }
];

const el = {
  search: document.getElementById('searchInput'),
  refresh: document.getElementById('refreshBtn'),
  themeToggle: document.getElementById('themeToggle'),
  status: document.getElementById('status'),
  musicFilter: document.getElementById('musicFilter'),
  keyFilter: document.getElementById('keyFilter'),
  tagFilter: document.getElementById('tagFilter'),
  typeFilter: document.getElementById('typeFilter'),
  favoritesOnly: document.getElementById('favoritesOnly'),
  clearFilters: document.getElementById('clearFilters'),
  openFiltersSheetBtn: document.getElementById('openFiltersSheetBtn'),
  closeFiltersSheetBtn: document.getElementById('closeFiltersSheetBtn'),
  filtersSheetBackdrop: document.getElementById('filtersSheetBackdrop'),
  filtersGrid: document.getElementById('filtersGrid'),
  randomBtn: document.getElementById('randomBtn'),
  copyLinkBtn: document.getElementById('copyLinkBtn'),
  totalTracks: document.getElementById('totalTracks'),
  totalSingers: document.getElementById('totalSingers'),
  totalSingersInline: document.getElementById('totalSingersInline'),
  totalKeys: document.getElementById('totalKeys'),
  totalFavorites: document.getElementById('totalFavorites'),
  heroTotal: document.getElementById('heroTotal'),
  heroSetlists: document.getElementById('heroSetlists'),
  heroFavs: document.getElementById('heroFavs'),
  heroKeys: document.getElementById('heroKeys'),
  heroCategories: document.getElementById('heroCategories'),
  heroTotalPanel: document.getElementById('heroTotalPanel'),
  resultCount: document.getElementById('resultCount'),
  viewThumbBtn: document.getElementById('viewThumbBtn'),
  viewDetailBtn: document.getElementById('viewDetailBtn'),
  loadSentinel: document.getElementById('loadSentinel'),
  loadStatus: document.getElementById('loadStatus'),
  trackList: document.getElementById('trackList'),
  setlistsGrid: document.getElementById('setlistsGrid'),
  archivedSetlistsSection: document.getElementById('archivedSetlistsSection'),
  archivedSetlistsGrid: document.getElementById('archivedSetlistsGrid'),
  archivedSetlistsCount: document.getElementById('archivedSetlistsCount'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  historyTotalPlays: document.getElementById('historyTotalPlays'),
  historyUniqueTracks: document.getElementById('historyUniqueTracks'),
  historyKeysUsed: document.getElementById('historyKeysUsed'),
  historyNotifications: document.getElementById('historyNotifications'),
  historyMostPlayed: document.getElementById('historyMostPlayed'),
  historyTopKeys: document.getElementById('historyTopKeys'),
  historyRecent: document.getElementById('historyRecent'),
  historyNotificationsList: document.getElementById('historyNotificationsList'),
  newSetlistBtn: document.getElementById('newSetlistBtn'),
  audio: document.getElementById('audioPlayer'),
  nowCover: document.getElementById('nowCover'),
  nowTitle: document.getElementById('nowTitle'),
  nowSinger: document.getElementById('nowSinger'),
  shuffleBtn: document.getElementById('shuffleBtn'),
  prevBtn: document.getElementById('prevBtn'),
  playPauseBtn: document.getElementById('playPauseBtn'),
  nextBtn: document.getElementById('nextBtn'),
  repeatBtn: document.getElementById('repeatBtn'),
  progressBar: document.getElementById('progressBar'),
  progressFill: document.getElementById('progressFill'),
  currentTime: document.getElementById('currentTime'),
  durationTime: document.getElementById('durationTime'),
  volumeBar: document.getElementById('volumeBar'),
  closePlayerBtn: document.getElementById('closePlayerBtn'),

  toneModal: document.getElementById('toneModal'),
  closeTone: document.getElementById('closeTone'),
  toneTrackName: document.getElementById('toneTrackName'),
  toneCurrent: document.getElementById('toneCurrent'),
  toneSelected: document.getElementById('toneSelected'),
  toneButtons: document.getElementById('toneButtons'),
  playToneBtn: document.getElementById('playToneBtn'),
  downloadToneBtn: document.getElementById('downloadToneBtn'),
  addToneToSetlistBtn: document.getElementById('addToneToSetlistBtn'),

  setlistModal: document.getElementById('setlistModal'),
  closeSetlist: document.getElementById('closeSetlist'),
  setlistTrackName: document.getElementById('setlistTrackName'),
  newSetlistName: document.getElementById('newSetlistName'),
  newSetlistDate: document.getElementById('newSetlistDate'),
  editSetlistDateModal: document.getElementById('editSetlistDateModal'),
  editSetlistDateTitle: document.getElementById('editSetlistDateTitle'),
  editSetlistDateInput: document.getElementById('editSetlistDateInput'),
  saveSetlistDateBtn: document.getElementById('saveSetlistDateBtn'),
  clearSetlistDateBtn: document.getElementById('clearSetlistDateBtn'),
  closeEditSetlistDate: document.getElementById('closeEditSetlistDate'),
  createSetlistBtn: document.getElementById('createSetlistBtn'),
  setlistOptions: document.getElementById('setlistOptions'),
  activeSetlistBanner: document.getElementById('activeSetlistBanner'),
  activeSetlistName: document.getElementById('activeSetlistName'),
  activeSetlistMeta: document.getElementById('activeSetlistMeta'),
  activeSetlistViewBtn: document.getElementById('activeSetlistViewBtn'),
  activeSetlistDoneBtn: document.getElementById('activeSetlistDoneBtn'),
  activeSetlistMiniBar: document.getElementById('activeSetlistMiniBar'),
  activeSetlistMiniName: document.getElementById('activeSetlistMiniName'),
  activeSetlistMiniViewBtn: document.getElementById('activeSetlistMiniViewBtn'),
  activeSetlistMiniDoneBtn: document.getElementById('activeSetlistMiniDoneBtn'),

  setlistDetailModal: document.getElementById('setlistDetailModal'),
  closeSetlistDetail: document.getElementById('closeSetlistDetail'),
  setlistDetailTitle: document.getElementById('setlistDetailTitle'),
  setlistDetailIntro: document.getElementById('setlistDetailIntro'),
  setlistSharedHero: document.getElementById('setlistSharedHero'),
  setlistDetailTracks: document.getElementById('setlistDetailTracks'),
  setlistDetailPalette: document.getElementById('setlistDetailPalette'),
  setlistPaletteViewModal: document.getElementById('setlistPaletteViewModal'),
  setlistPaletteViewTitle: document.getElementById('setlistPaletteViewTitle'),
  setlistPaletteViewBody: document.getElementById('setlistPaletteViewBody'),
  setlistPaletteViewChangeBtn: document.getElementById('setlistPaletteViewChangeBtn'),
  setlistPaletteViewCloseBtn: document.getElementById('setlistPaletteViewCloseBtn'),
  closeSetlistPaletteView: document.getElementById('closeSetlistPaletteView'),
  playSetlistDetail: document.getElementById('playSetlistDetail'),
  addMusicSetlistDetail: document.getElementById('addMusicSetlistDetail'),
  changeSetlistPaletteBtn: document.getElementById('changeSetlistPaletteBtn'),
  shareSetlistDetail: document.getElementById('shareSetlistDetail'),
  shareSetlistModal: document.getElementById('shareSetlistModal'),
  closeShareSetlistModal: document.getElementById('closeShareSetlistModal'),
  shareSetlistModalTitle: document.getElementById('shareSetlistModalTitle'),
  shareSetlistModalMeta: document.getElementById('shareSetlistModalMeta'),
  shareSetlistCopyLink: document.getElementById('shareSetlistCopyLink'),
  shareSetlistNativeShare: document.getElementById('shareSetlistNativeShare'),
  setlistReviewModal: document.getElementById('setlistReviewModal'),
  closeSetlistReview: document.getElementById('closeSetlistReview'),
  setlistReviewTitle: document.getElementById('setlistReviewTitle'),
  setlistReviewMeta: document.getElementById('setlistReviewMeta'),
  setlistReviewTracks: document.getElementById('setlistReviewTracks'),
  setlistReviewBackBtn: document.getElementById('setlistReviewBackBtn'),
  setlistReviewConfirmBtn: document.getElementById('setlistReviewConfirmBtn'),
  paletteModal: document.getElementById('paletteModal'),
  closePaletteModal: document.getElementById('closePaletteModal'),
  paletteModalTitle: document.getElementById('paletteModalTitle'),
  paletteModalImage: document.getElementById('paletteModalImage'),
  paletteModalUseBtn: document.getElementById('paletteModalUseBtn'),
  paletteModalCloseBtn: document.getElementById('paletteModalCloseBtn'),
  paletteSelectionTarget: document.getElementById('paletteSelectionTarget'),
  paletteChooseSetlistModal: document.getElementById('paletteChooseSetlistModal'),
  closePaletteChooseSetlist: document.getElementById('closePaletteChooseSetlist'),
  paletteChooseTitle: document.getElementById('paletteChooseTitle'),
  paletteChooseDescription: document.getElementById('paletteChooseDescription'),
  paletteChoosePreview: document.getElementById('paletteChoosePreview'),
  paletteChooseList: document.getElementById('paletteChooseList'),

  songModal: document.getElementById('songModal'),
  closeSongModal: document.getElementById('closeSongModal'),
  songModalCover: document.getElementById('songModalCover'),
  songModalTitle: document.getElementById('songModalTitle'),
  songModalSubtitle: document.getElementById('songModalSubtitle'),
  songModalMeta: document.getElementById('songModalMeta'),
  songModalTags: document.getElementById('songModalTags'),
  songModalPlay: document.getElementById('songModalPlay'),
  songModalDownload: document.getElementById('songModalDownload'),
  songModalFavorite: document.getElementById('songModalFavorite'),
  songModalTone: document.getElementById('songModalTone'),
  songModalShare: document.getElementById('songModalShare'),
  tutorialStartBtn: document.getElementById('tutorialStartBtn'),
  tutorialPageStartBtn: document.getElementById('tutorialPageStartBtn'),
  heroSingers: document.getElementById('heroSingers'),
  totalActiveSetlists: document.getElementById('totalActiveSetlists'),
  totalActiveSetlists2: document.getElementById('totalActiveSetlists2'),
  nextCultoName: document.getElementById('nextCultoName'),
  nextCultoDate: document.getElementById('nextCultoDate'),
  nextCultoStat: document.getElementById('nextCultoStat'),
  adminPage: document.getElementById('adminPage'),
  adminRefreshBtn: document.getElementById('adminRefreshBtn'),
  adminUsersBody: document.getElementById('adminUsersBody'),
  adminUsersWrap: document.getElementById('adminUsersWrap'),
  adminUserCount: document.getElementById('adminUserCount'),
  adminLoadingMsg: document.getElementById('adminLoadingMsg'),
  adminAccessLog: document.getElementById('adminAccessLog'),
  tourOverlay: document.getElementById('tourOverlay'),
  tourTitle: document.getElementById('tourTitle'),
  tourDescription: document.getElementById('tourDescription'),
  tourStepCurrent: document.getElementById('tourStepCurrent'),
  tourStepTotal: document.getElementById('tourStepTotal'),
  tourPrevBtn: document.getElementById('tourPrevBtn'),
  tourNextBtn: document.getElementById('tourNextBtn'),
  tourSkipBtn: document.getElementById('tourSkipBtn'),
  tourPrevArrow: document.getElementById('tourPrevArrow'),
  tourNextArrow: document.getElementById('tourNextArrow'),
  tourCard: document.getElementById('tourCard'),
  tourSpotlight: document.getElementById('tourSpotlight'),
  tourProgress: document.getElementById('tourProgress'),
  tourDontShowAgain: document.getElementById('tourDontShowAgain'),
  loadingScreen: document.getElementById('loadingScreen'),
  loadingMessage: document.getElementById('loadingMessage'),
  loadingStage: document.getElementById('loadingStage'),
  loadingStats: document.getElementById('loadingStats'),
  loadingProgressFill: document.getElementById('loadingProgressFill'),
  loadingSkipBtn: document.getElementById('loadingSkipBtn'),
  loginScreen: document.getElementById('loginScreen'),  loginName: document.getElementById('loginName'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  loginNameField: document.getElementById('loginNameField'),
  loginEmailField: document.getElementById('loginEmailField'),
  loginPasswordField: document.getElementById('loginPasswordField'),
  togglePasswordBtn: document.getElementById('togglePasswordBtn'),
  rememberSession: document.getElementById('rememberSession'),
  recoverPasswordBtn: document.getElementById('recoverPasswordBtn'),
  resetPasswordBox: document.getElementById('resetPasswordBox'),
  resetPassword: document.getElementById('resetPassword'),
  resetPasswordConfirm: document.getElementById('resetPasswordConfirm'),
  resetPasswordField: document.getElementById('resetPasswordField'),
  resetPasswordConfirmField: document.getElementById('resetPasswordConfirmField'),
  toggleResetPasswordBtn: document.getElementById('toggleResetPasswordBtn'),
  toggleResetPasswordConfirmBtn: document.getElementById('toggleResetPasswordConfirmBtn'),
  confirmPasswordRecoveryBtn: document.getElementById('confirmPasswordRecoveryBtn'),
  cancelPasswordRecoveryBtn: document.getElementById('cancelPasswordRecoveryBtn'),
  modeLoginBtn: document.getElementById('modeLoginBtn'),
  modeRegisterBtn: document.getElementById('modeRegisterBtn'),
  authModeHint: document.getElementById('authModeHint'),
  loginNote: document.getElementById('loginNote'),
  createAccountBtn: document.getElementById('createAccountBtn'),
  authStatus: document.getElementById('authStatus'),
  enterSystemBtn: document.getElementById('enterSystemBtn'),
  userBadge: document.getElementById('userBadge'),
  logoutBtn: document.getElementById('logoutBtn'),
  profileModal: document.getElementById('profileModal'),
  closeProfileModal: document.getElementById('closeProfileModal'),
  profileAvatar: document.getElementById('profileAvatar'),
  profileName: document.getElementById('profileName'),
  profileEmail: document.getElementById('profileEmail'),
  profileRole: document.getElementById('profileRole'),
  profilePermission: document.getElementById('profilePermission'),
  profileFavorites: document.getElementById('profileFavorites'),
  profileSetlists: document.getElementById('profileSetlists'),
  profileStartTourBtn: document.getElementById('profileStartTourBtn'),
  profileLogoutBtn: document.getElementById('profileLogoutBtn'),
  scheduleSearch: document.getElementById('scheduleSearch'),
  scheduleDayFilter: document.getElementById('scheduleDayFilter'),
  scheduleRoleFilter: document.getElementById('scheduleRoleFilter'),
  scheduleMemberFilter: document.getElementById('scheduleMemberFilter'),
  scheduleClearBtn: document.getElementById('scheduleClearBtn'),
  schedulePrintBtn: document.getElementById('schedulePrintBtn'),
  scheduleSaveBtn: document.getElementById('scheduleSaveBtn'),
  scheduleEditStatus: document.getElementById('scheduleEditStatus'),
  scheduleSummary: document.getElementById('scheduleSummary'),
  scheduleCards: document.getElementById('scheduleCards'),
  scheduleTableBody: document.getElementById('scheduleTableBody'),
  scheduleMonthNav: document.getElementById('scheduleMonthNav'),
  scheduleTitle: document.getElementById('scheduleTitle'),
  scheduleImportBtn: document.getElementById('scheduleImportBtn'),
  scheduleImportInput: document.getElementById('scheduleImportInput'),
};

document.title = cfg.APP_TITLE;

initAppwriteClient();
// V131 — Recupera chave do Drive salva para o fallback de áudio estar pronto imediatamente
try { const k = localStorage.getItem('vs_drive_key'); if (k && cfg && !cfg.DRIVE_API_KEY) cfg.DRIVE_API_KEY = k; } catch(_){}
// V127 — Pré-aquece o servidor Render imediatamente ao abrir o app,
// antes mesmo do login. Isso reduz o cold start para o usuário:
// enquanto ele digita login/senha, o servidor já está acordando.
// Fire-and-forget — não bloqueia nada, falha silenciosamente.
fetch('/ping').catch(() => {});
loadAppwriteServerConfig().finally(initSessionUI);
bindEvents();
initSchedule();
initAdminPage();
bindEditSetlistDateModal();
bindShareSetlistModal();
applyTheme(loadJSON('vs_theme_v1', 'dark'));
routeInternalPage();
// V109 — loginScreen começa com .hidden → garante inert para não receber foco
if (el.loginScreen?.classList.contains('hidden')) {
  el.loginScreen.setAttribute('inert', '');
}

function setPlayButtonState(isPlaying){
  if (!el.playPauseBtn) return;
  el.playPauseBtn.setAttribute('aria-label', isPlaying ? 'Pausar' : 'Tocar');
  el.playPauseBtn.innerHTML = `<span class="player-icon ${isPlaying ? 'player-icon-pause' : 'player-icon-play'}" aria-hidden="true"></span>`;
}


function openFiltersSheet(){
  el.filtersGrid?.classList.add('is-open');
  el.filtersSheetBackdrop?.classList.remove('hidden');
  document.body.classList.add('filters-sheet-open');
}
function closeFiltersSheet(){
  el.filtersGrid?.classList.remove('is-open');
  el.filtersSheetBackdrop?.classList.add('hidden');
  document.body.classList.remove('filters-sheet-open');
}

function bindEvents(){
  window.addEventListener('hashchange', routeInternalPage);
  let lastMusicViewIsMobile = isMobileMusicView();
  window.addEventListener('resize', () => {
    const nowMobile = isMobileMusicView();
    if (nowMobile === lastMusicViewIsMobile) {
      applyViewMode();
      return;
    }
    lastMusicViewIsMobile = nowMobile;
    const previousScroll = window.scrollY;
    applyViewMode();
    render();
    requestAnimationFrame(() => window.scrollTo({ top: previousScroll, behavior: 'auto' }));
  });
  el.search.addEventListener('input', onGlobalSearchInput);
  el.search.addEventListener('keydown', onGlobalSearchKeydown);
  el.viewThumbBtn.addEventListener('click', () => setViewMode('thumbnails'));
  el.viewDetailBtn.addEventListener('click', () => setViewMode('details'));
  el.musicFilter.addEventListener('change', render);
  el.keyFilter.addEventListener('change', render);
  el.tagFilter.addEventListener('change', render);
  el.typeFilter.addEventListener('change', render);
  el.refresh.addEventListener('click', () => forceRefreshDriveLibrary());
  if (el.loadingSkipBtn) el.loadingSkipBtn.addEventListener('click', () => {
    hideLoading();
    toast('Músicas aparecerão conforme carregam.');
  });
  el.themeToggle.addEventListener('click', toggleTheme);
  el.favoritesOnly.addEventListener('click', () => {
    isFavoritesFilter = !isFavoritesFilter;
    el.favoritesOnly.classList.toggle('favorites-active', isFavoritesFilter);
    render();
    renderHistoryDashboard();
  });
  el.clearFilters.addEventListener('click', clearFilters);
  el.randomBtn.addEventListener('click', () => {
    const list = getFiltered();
    if (!list.length) return;
    randomContinuousMode = true;
    shuffleMode = true;
    el.shuffleBtn?.classList.add('favorites-active');
    playTrack(list[Math.floor(Math.random() * list.length)], 0, list, { randomContinuous: true });
    toast('Reprodução aleatória contínua iniciada.');
  });
  el.copyLinkBtn.addEventListener('click', () => copyText(location.origin + location.pathname, 'Link do sistema copiado.'));

  el.shuffleBtn.addEventListener('click', () => {
    shuffleMode = !shuffleMode;
    if (!shuffleMode) randomContinuousMode = false;
    el.shuffleBtn.classList.toggle('favorites-active', shuffleMode);
  });
  el.repeatBtn.addEventListener('click', () => {
    repeatMode = !repeatMode;
    el.repeatBtn.classList.toggle('favorites-active', repeatMode);
  });
  el.prevBtn.addEventListener('click', playPrev);
  el.nextBtn.addEventListener('click', playNext);
  el.playPauseBtn.addEventListener('click', togglePlayPause);
  el.closePlayerBtn?.addEventListener('click', closePlayer);
  el.progressBar.addEventListener('input', onSeek);
  // V123 — Corrige bug onde a barra de progresso "trava" e não deixa arrastar.
  // Causa: o evento 'timeupdate' do áudio dispara a cada ~250ms e sobrescreve
  // o .value da barra continuamente, inclusive durante o arrasto do usuário —
  // a escrita do JS "briga" com o gesto do usuário e o controle volta para a
  // posição real da música quase instantaneamente. No desktop (mouse) e Android
  // isso trava visivelmente; no iOS funciona por acaso porque o WebKit dá
  // prioridade ao toque nativo sobre escritas JS durante o gesto.
  // Solução: pausar a sincronização automática enquanto o usuário interage.
  const startSeeking = () => { isUserSeeking = true; };
  const endSeeking = () => {
    isUserSeeking = false;
    onSeek(); // garante que a posição final do arrasto seja aplicada
  };
  el.progressBar.addEventListener('mousedown', startSeeking);
  el.progressBar.addEventListener('touchstart', startSeeking, { passive: true });
  el.progressBar.addEventListener('pointerdown', startSeeking);
  el.progressBar.addEventListener('mouseup', endSeeking);
  el.progressBar.addEventListener('touchend', endSeeking);
  el.progressBar.addEventListener('pointerup', endSeeking);
  // Fallback: se o usuário soltar o botão fora da barra, ainda assim libera
  window.addEventListener('mouseup', () => { if (isUserSeeking) endSeeking(); });
  window.addEventListener('touchend', () => { if (isUserSeeking) endSeeking(); });
  el.volumeBar.addEventListener('input', () => el.audio.volume = Number(el.volumeBar.value) / 100);
  el.audio.volume = 1;
  el.audio.addEventListener('play', () => setPlayButtonState(true));
  el.audio.addEventListener('pause', () => setPlayButtonState(false));
  el.audio.addEventListener('timeupdate', syncProgressUI);
  el.audio.addEventListener('loadedmetadata', syncProgressUI);
  el.audio.addEventListener('ended', handleAudioEnded);
  // V131 — Quando a fonte de áudio falha em carregar (erro de rede/500 do proxy),
  // tenta automaticamente a próxima fonte na lista de candidatas.
  el.audio.addEventListener('error', () => {
    const candidates = el.audio._candidates || [];
    const nextIndex = (el.audio._candidateIndex || 0) + 1;
    if (nextIndex < candidates.length) {
      console.warn(`[audio] erro ao carregar fonte ${el.audio._candidateIndex}, tentando fonte ${nextIndex}`);
      loadAudioCandidate(nextIndex);
    } else {
      console.error('[audio] todas as fontes falharam');
      setPlayButtonState(false);
    }
  });

  el.closeTone.addEventListener('click', closeToneModal);
  el.toneModal.addEventListener('click', e => { if (e.target === el.toneModal) closeToneModal(); });
  el.playToneBtn.addEventListener('click', () => {
    if (!toneTarget) return;
    playTrack(toneTarget, selectedSemitone, getFiltered());
    closeToneModal();
  });
  if (el.addToneToSetlistBtn) {
    el.addToneToSetlistBtn.addEventListener('click', () => {
      if (!toneTarget) return;
      const tone = selectedToneLabel || '';
      const active = getActiveEditableSetlist();
      if (active) {
        closeToneModal();
        addTrackToSetlist(active, toneTarget, { semitones: selectedSemitone, tone }, { toastMessage: `Música adicionada ao repertório ativo: ${active.name}.` });
        return;
      }
      closeToneModal();
      openSetlistModal(toneTarget, { semitones: selectedSemitone, tone });
    });
  }

  el.newSetlistBtn.addEventListener('click', () => openSetlistModal(null));
  el.closeSetlist.addEventListener('click', closeSetlistModal);
  el.setlistModal.addEventListener('click', e => { if (e.target === el.setlistModal) closeSetlistModal(); });
  el.createSetlistBtn.addEventListener('click', createSetlistFromInput);
  if (el.activeSetlistViewBtn) el.activeSetlistViewBtn.addEventListener('click', () => {
    const active = getActiveSetlist();
    if (!active) {
      toast('Nenhum repertório ativo.');
      clearActiveSetlist();
      return;
    }
    openSetlistDetail(active.id);
  });
  if (el.activeSetlistDoneBtn) el.activeSetlistDoneBtn.addEventListener('click', () => concludeActiveSetlist());
  if (el.activeSetlistMiniViewBtn) el.activeSetlistMiniViewBtn.addEventListener('click', () => el.activeSetlistViewBtn?.click());
  if (el.activeSetlistMiniDoneBtn) el.activeSetlistMiniDoneBtn.addEventListener('click', () => concludeActiveSetlist());
  if (el.openFiltersSheetBtn) el.openFiltersSheetBtn.addEventListener('click', openFiltersSheet);
  if (el.closeFiltersSheetBtn) el.closeFiltersSheetBtn.addEventListener('click', closeFiltersSheet);
  if (el.filtersSheetBackdrop) el.filtersSheetBackdrop.addEventListener('click', closeFiltersSheet);

  if (el.closeSetlistReview) el.closeSetlistReview.addEventListener('click', closeSetlistReviewModal);
  if (el.setlistReviewModal) el.setlistReviewModal.addEventListener('click', e => { if (e.target === el.setlistReviewModal) closeSetlistReviewModal(); });
  if (el.setlistReviewBackBtn) el.setlistReviewBackBtn.addEventListener('click', () => {
    const active = getActiveSetlist();
    closeSetlistReviewModal();
    if (active) {
      openSetlistDetail(active.id);
      return;
    }
    location.hash = '#biblioteca';
    routeInternalPage();
    render();
  });
  if (el.setlistReviewConfirmBtn) el.setlistReviewConfirmBtn.addEventListener('click', confirmActiveSetlistConclusion);

  el.closeSetlistDetail.addEventListener('click', closeSetlistDetail);
  el.setlistDetailModal.addEventListener('click', e => { if (e.target === el.setlistDetailModal) closeSetlistDetail(); });
  el.playSetlistDetail.addEventListener('click', () => {
    const s = setlists.find(x => x.id === currentSetlistDetailId);
    if (!s) return;
    const tracks = mapSetlistTracks(s);
    if (tracks.length) playTrack(tracks[0], null, tracks);
  });
  if (el.addMusicSetlistDetail) el.addMusicSetlistDetail.addEventListener('click', () => {
    const s = setlists.find(x => x.id === currentSetlistDetailId);
    if (!s) return;
    if (!canEditSetlist(s)) {
      toast('Somente quem criou este repertório pode adicionar músicas.');
      return;
    }
    setActiveSetlist(s.id);
    closeSetlistDetail();
    location.hash = '#biblioteca';
    routeInternalPage();
    render();
    toast(`Repertório “${s.name}” ativo. Adicione músicas na biblioteca.`);
  });
  // V131.25 — O botão "🎨 Paleta" agora abre um modal mostrando a paleta
  // escolhida (visível para todos). A troca fica dentro do modal, só para
  // quem pode editar.
  if (el.changeSetlistPaletteBtn) el.changeSetlistPaletteBtn.addEventListener('click', () => {
    const s = setlists.find(x => x.id === currentSetlistDetailId);
    if (!s) return;
    openSetlistPaletteView(s);
  });
  if (el.closeSetlistPaletteView) el.closeSetlistPaletteView.addEventListener('click', closeSetlistPaletteView);
  if (el.setlistPaletteViewCloseBtn) el.setlistPaletteViewCloseBtn.addEventListener('click', closeSetlistPaletteView);
  if (el.setlistPaletteViewModal) el.setlistPaletteViewModal.addEventListener('click', e => { if (e.target === el.setlistPaletteViewModal) closeSetlistPaletteView(); });
  if (el.setlistPaletteViewChangeBtn) el.setlistPaletteViewChangeBtn.addEventListener('click', () => {
    const s = setlists.find(x => x.id === currentSetlistDetailId);
    if (!s) return;
    if (!canEditSetlist(s)) {
      toast('Somente quem criou este repertório pode alterar a paleta.');
      return;
    }
    closeSetlistPaletteView();
    startPaletteSelectionForSetlist(s, 'setlist-detail');
  });
  el.shareSetlistDetail.addEventListener('click', () => {
    const s = setlists.find(x => x.id === currentSetlistDetailId);
    if (s) shareSetlistWithPaletteCheck(s);
  });

  if (el.closePaletteModal) el.closePaletteModal.addEventListener('click', closePaletteModal);
  if (el.paletteModalCloseBtn) el.paletteModalCloseBtn.addEventListener('click', closePaletteModal);
  if (el.paletteModalUseBtn) el.paletteModalUseBtn.addEventListener('click', () => {
    const palette = {
      id: el.paletteModal?.dataset?.paletteId,
      title: el.paletteModal?.dataset?.paletteTitle,
      image: el.paletteModal?.dataset?.paletteImage
    };
    if (palette.image && palette.title) handlePaletteUse(palette);
  });
  if (el.paletteModal) el.paletteModal.addEventListener('click', e => { if (e.target === el.paletteModal) closePaletteModal(); });
  if (el.closePaletteChooseSetlist) el.closePaletteChooseSetlist.addEventListener('click', closePaletteChooseSetlistModal);
  if (el.paletteChooseSetlistModal) el.paletteChooseSetlistModal.addEventListener('click', e => { if (e.target === el.paletteChooseSetlistModal) closePaletteChooseSetlistModal(); });
  document.querySelectorAll('.palette-card').forEach(card => {
    const openBtn = card.querySelector('.palette-open-btn');
    const applyBtn = card.querySelector('.palette-apply-btn');
    const palette = { id: card.dataset.paletteId, title: card.dataset.paletteTitle, image: card.dataset.paletteImage };
    if (openBtn) openBtn.addEventListener('click', ev => { ev.stopPropagation(); openPaletteModal(palette.title || 'Paleta de cores', palette.image, palette.id); });
    if (applyBtn) applyBtn.addEventListener('click', ev => { ev.stopPropagation(); handlePaletteUse(palette); });
    card.addEventListener('click', () => openPaletteModal(palette.title || 'Paleta de cores', palette.image, palette.id));
  });

  el.closeSongModal.addEventListener('click', closeSongModal);
  el.songModal.addEventListener('click', e => { if (e.target === el.songModal) closeSongModal(); });
  el.songModalPlay.addEventListener('click', () => {
    if (!songModalTarget) return;
    playTrack(songModalTarget, 0, getFiltered());
    closeSongModal();
  });
  el.songModalFavorite.addEventListener('click', () => {
    if (!songModalTarget) return;
    toggleFavorite(songModalTarget.id);
    openSongModal(allTracks.find(t => t.id === songModalTarget.id));
  });
  el.songModalTone.addEventListener('click', () => { if (songModalTarget) { closeSongModal(); openToneModal(songModalTarget); } });
  el.songModalShare.addEventListener('click', () => { if (songModalTarget) shareTrack(songModalTarget); });
  // V95 — feedback de download no modal de detalhes
  if (el.songModalDownload) {
    el.songModalDownload.addEventListener('click', () => {
      if (!songModalTarget) return;
      toast(`Baixando "${songModalTarget.name}" no tom original.`);
      try {
        recordUsageEvent({
          type: 'track_downloaded',
          trackId: songModalTarget.id,
          trackName: songModalTarget.name,
          tone: songModalTarget.key || '',
          semitones: 0,
          message: `Música "${songModalTarget.name}" baixada (tom original).`
        });
      } catch (_) {}
    });
  }

  if (el.tutorialStartBtn) el.tutorialStartBtn.addEventListener('click', startGuidedTour);
  if (el.tutorialPageStartBtn) el.tutorialPageStartBtn.addEventListener('click', startGuidedTour);
  if (el.tourPrevBtn) el.tourPrevBtn.addEventListener('click', () => changeTourStep(-1));
  if (el.tourNextBtn) el.tourNextBtn.addEventListener('click', () => changeTourStep(1));
  if (el.tourPrevArrow) el.tourPrevArrow.addEventListener('click', () => changeTourStep(-1));
  if (el.tourNextArrow) el.tourNextArrow.addEventListener('click', () => changeTourStep(1));
  if (el.tourSkipBtn) el.tourSkipBtn.addEventListener('click', finishGuidedTour);
  if (el.tourOverlay) el.tourOverlay.addEventListener('click', (e) => { if (e.target === el.tourOverlay || e.target.classList.contains('tour-backdrop')) finishGuidedTour(); });
  window.addEventListener('resize', () => { if (!el.tourOverlay?.classList.contains('hidden')) renderTourStep(); });
  window.addEventListener('scroll', () => { if (!el.tourOverlay?.classList.contains('hidden')) positionTourToTarget(document.querySelector(TOUR_STEPS[tourStepIndex]?.selector)); }, { passive: true });

  if (el.enterSystemBtn) el.enterSystemBtn.addEventListener('click', () => {
    if (authMode === 'register') {
      setAuthMode('login');
    } else {
      enterSystem();
    }
  });
  // 1) Se estiver no modo login: muda para modo registro (mostra campo Nome).
  // 2) Se estiver no modo registro: executa o cadastro.
  if (el.createAccountBtn) el.createAccountBtn.addEventListener('click', () => {
    if (authMode === 'register') {
      createAccount();
    } else {
      setAuthMode('register');
    }
  });
  if (el.modeLoginBtn) el.modeLoginBtn.addEventListener('click', () => setAuthMode('login'));
  if (el.modeRegisterBtn) el.modeRegisterBtn.addEventListener('click', () => setAuthMode('register'));
  if (el.togglePasswordBtn) el.togglePasswordBtn.addEventListener('click', () => togglePasswordVisibility('loginPassword', 'togglePasswordBtn'));
  if (el.recoverPasswordBtn) el.recoverPasswordBtn.addEventListener('click', recoverPassword);
  if (el.toggleResetPasswordBtn) el.toggleResetPasswordBtn.addEventListener('click', () => togglePasswordVisibility('resetPassword', 'toggleResetPasswordBtn'));
  if (el.toggleResetPasswordConfirmBtn) el.toggleResetPasswordConfirmBtn.addEventListener('click', () => togglePasswordVisibility('resetPasswordConfirm', 'toggleResetPasswordConfirmBtn'));
  if (el.confirmPasswordRecoveryBtn) el.confirmPasswordRecoveryBtn.addEventListener('click', confirmPasswordRecovery);
  if (el.cancelPasswordRecoveryBtn) el.cancelPasswordRecoveryBtn.addEventListener('click', showLoginMode);
  if (el.resetPassword) el.resetPassword.addEventListener('keydown', e => { if (e.key === 'Enter') confirmPasswordRecovery(); });
  if (el.resetPasswordConfirm) el.resetPasswordConfirm.addEventListener('keydown', e => { if (e.key === 'Enter') confirmPasswordRecovery(); });
  if (el.userBadge) el.userBadge.addEventListener('click', openProfileModal);
  if (el.closeProfileModal) el.closeProfileModal.addEventListener('click', closeProfileModal);
  if (el.profileModal) el.profileModal.addEventListener('click', e => { if (e.target === el.profileModal) closeProfileModal(); });
  if (el.profileStartTourBtn) el.profileStartTourBtn.addEventListener('click', () => { closeProfileModal(); startGuidedTour(); });
  if (el.profileLogoutBtn) el.profileLogoutBtn.addEventListener('click', () => { closeProfileModal(); logoutSession(); });
  ['loginName','loginEmail','loginPassword'].forEach(key => { const node = el[key]; if (node) node.addEventListener('input', () => validateAuthField(key)); });
  if (el.loginName) el.loginName.addEventListener('keydown', e => { if (e.key === 'Enter') enterSystem(); });
  if (el.loginEmail) el.loginEmail.addEventListener('keydown', e => { if (e.key === 'Enter') enterSystem(); });
  if (el.loginPassword) el.loginPassword.addEventListener('keydown', e => { if (e.key === 'Enter') authMode === 'register' ? createAccount() : enterSystem(); });
  if (el.logoutBtn) el.logoutBtn.addEventListener('click', logoutSession);


  if (el.scheduleSearch) el.scheduleSearch.addEventListener('input', renderSchedule);
  if (el.scheduleDayFilter) el.scheduleDayFilter.addEventListener('change', renderSchedule);
  if (el.scheduleMemberFilter) el.scheduleMemberFilter.addEventListener('change', renderSchedule);
  if (el.scheduleTableBody) el.scheduleTableBody.addEventListener('change', onScheduleSelectChange);
  if (el.scheduleSaveBtn) el.scheduleSaveBtn.addEventListener('click', () => saveScheduleState(true));
  if (el.scheduleClearBtn) el.scheduleClearBtn.addEventListener('click', clearScheduleFilters);
  if (el.schedulePrintBtn) el.schedulePrintBtn.addEventListener('click', () => window.print());
  if (el.clearHistoryBtn) el.clearHistoryBtn.addEventListener('click', () => {
    if (!confirm('Limpar histórico local deste dispositivo?')) return;
    usageHistory = [];
    saveJSON('vs_usage_history_v51', usageHistory);
    renderHistoryDashboard();
    toast('Histórico local limpo.');
  });

  document.querySelectorAll('.tutorial-item').forEach(item => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      document.querySelectorAll('.tutorial-item').forEach(other => { if (other !== item) other.removeAttribute('open'); });
    });
  });
}


function onGlobalSearchInput(){
  render();
  const query = String(el.search?.value || '').trim();
  if (getPageFromHash() === 'home' && query) {
    location.hash = '#biblioteca';
    setTimeout(() => { routeInternalPage(); render(); }, 0);
  }
}

function onGlobalSearchKeydown(event){
  if (event.key !== 'Enter') return;
  const query = String(el.search?.value || '').trim();
  if (!query) return;
  if (getPageFromHash() !== 'library') {
    event.preventDefault();
    location.hash = '#biblioteca';
    setTimeout(() => { routeInternalPage(); render(); }, 0);
  }
}

function getPageFromHash(){
  const hash = (location.hash || '#inicio').replace('#','');
  if (hash === 'biblioteca' || hash === 'filters') return 'library';
  if (hash === 'escalaMensal' || hash === 'escala') return 'schedule';
  if (hash === 'repertorios') return 'setlists';
  if (hash === 'paletas' || hash === 'paletaCores') return 'palettes';
  if (hash === 'historico' || hash === 'history') return 'history';
  if (hash === 'tutorialPage' || hash === 'tutorial' || hash === 'quickGuide') return 'tutorial';
  if (hash === 'adminPage') return 'admin';
  return 'home';
}

function routeInternalPage(){
  const page = getPageFromHash();
  const content = document.querySelector('.content');
  if (!content) return;

  // V120 — Alterna visibilidade entre o main principal e o adminPage
  const mainContent = document.querySelector('.content');
  const adminPageEl = el.adminPage;
  if (page === 'admin') {
    if (mainContent) mainContent.style.display = 'none';
    if (adminPageEl) { adminPageEl.classList.remove('hidden'); adminPageEl.removeAttribute('inert'); }
    updateAdminNavVisibility();
    loadAdminData();
    // Marca link ativo no sidebar
    document.querySelectorAll('.sidebar-nav a, .mobile-dock a').forEach(link => {
      link.classList.toggle('is-active', link.getAttribute('href') === '#adminPage');
    });
    return;
  } else {
    if (mainContent) mainContent.style.display = '';
    if (adminPageEl) { adminPageEl.classList.add('hidden'); adminPageEl.setAttribute('inert', ''); }
  }

  content.classList.remove('page-mode-home','page-mode-library','page-mode-schedule','page-mode-setlists','page-mode-palettes','page-mode-history','page-mode-tutorial','page-mode-player-removed','page-mode-admin');
  content.classList.add(`page-mode-${page}`);

  const activeHashByPage = {
    home: '#inicio',
    library: '#biblioteca',
    schedule: '#escalaMensal',
    palettes: '#paletas',
    setlists: '#repertorios',
    history: '#historico',
    tutorial: '#tutorialPage'
  };
  const activeHash = activeHashByPage[page];

  document.querySelectorAll('.sidebar-nav a, .mobile-dock a').forEach(link => {
    const href = link.getAttribute('href') || '';
    const normalized = href === '#escala' ? '#escalaMensal' : href;
    link.classList.toggle('is-active', normalized === activeHash);
  });

  const targetByPage = {
    home: document.querySelector('.hero') || document.querySelector('#inicio'),
    library: document.querySelector('#biblioteca'),
    schedule: document.querySelector('#escalaMensal'),
    palettes: document.querySelector('#paletas'),
    setlists: document.querySelector('#repertorios'),
    history: document.querySelector('#historico'),
    tutorial: document.querySelector('#tutorialPage')
  };

  const target = targetByPage[page];
  if (target && !document.startViewTransition) {
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  }
}

function initAppwriteClient(){
  try {
    const endpoint = cfg.APPWRITE_ENDPOINT;
    const projectId = cfg.APPWRITE_PROJECT_ID;
    if (!window.Appwrite || !endpoint || !projectId) {
      cloudReady = false;
      return;
    }
    const { Client, Account } = window.Appwrite;
    appwriteClient = new Client().setEndpoint(endpoint).setProject(projectId);
    appwriteAccount = new Account(appwriteClient);
    cloudReady = true;
  } catch (error) {
    console.warn('Appwrite Auth não inicializado:', error);
    cloudReady = false;
  }
}
async function loadAppwriteServerConfig(){
  try {
    const res = await fetch('/api/appwrite/config');
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.adminEmails)) cloudAdminEmails = data.adminEmails.map(e => String(e).toLowerCase());
    cloudAdminConfigured = Boolean(data.adminConfigured);
    // V131 — Salva chave do Drive para o fallback de áudio direto funcionar
    if (data.driveApiKey) {
      cfg.DRIVE_API_KEY = data.driveApiKey;
      try { localStorage.setItem('vs_drive_key', data.driveApiKey); } catch(_) {}
    }
    // V116/V120 — Re-renderiza após carregar adminEmails
    updateAdminNavVisibility(); // sempre — independe de authUser
    if (authUser) {
      renderSetlists();
      renderSchedule();
    }
  } catch (error) {
    console.warn('Configuração do servidor não carregada:', error);
  }
}

function setAuthMode(mode = 'login'){
  authMode = mode === 'register' ? 'register' : 'login';
  const isRegister = authMode === 'register';
  el.modeLoginBtn?.classList.toggle('is-active', !isRegister);
  el.modeRegisterBtn?.classList.toggle('is-active', isRegister);
  el.modeLoginBtn?.setAttribute('aria-selected', String(!isRegister));
  el.modeRegisterBtn?.setAttribute('aria-selected', String(isRegister));
  el.createAccountBtn?.classList.toggle('btn-primary', isRegister);
  el.createAccountBtn?.classList.toggle('btn-secondary', !isRegister);
  el.enterSystemBtn?.classList.toggle('btn-primary', !isRegister);
  el.enterSystemBtn?.classList.toggle('btn-secondary', isRegister);
  if (el.loginScreen) el.loginScreen.dataset.authMode = authMode;
  if (el.loginNameField) {
    el.loginNameField.classList.toggle('hidden', !isRegister);
    el.loginNameField.style.display = isRegister ? '' : 'none';
  }
  el.recoverPasswordBtn?.classList.toggle('hidden', isRegister);
  // V102 — authModeHint foi removido do HTML (era redundante com loginNote)
  if (el.authModeHint) el.authModeHint.style.display = 'none';
  // V105 — loginNote e textos dos botões refletem o fluxo em dois passos.
  if (el.loginNote) el.loginNote.textContent = isRegister
    ? 'Preencha nome, e-mail e senha para criar sua conta.'
    : '';
  // Modo login:    [Entrar] [Criar cadastro →]
  // Modo registro: [← Voltar ao login] [Criar minha conta]
  if (el.enterSystemBtn) el.enterSystemBtn.textContent = isRegister ? '← Voltar ao login' : 'Entrar';
  if (el.createAccountBtn) el.createAccountBtn.textContent = isRegister ? 'Criar minha conta' : 'Criar cadastro';
  setAuthStatus('', false);
  // V111 — NÃO disparar validação automática ao trocar de modo.
  // Antes: campos apareciam em vermelho antes do usuário digitar qualquer coisa.
  // Agora: resetamos os estados para neutro ao trocar de modo.
  if (el.loginNameField) setFieldState(el.loginNameField, 'neutral', 'Informe seu nome completo.');
  if (el.loginEmailField) setFieldState(el.loginEmailField, 'neutral', '');
  if (el.loginPasswordField) {
    const hint = isRegister ? 'Mínimo 8 caracteres.' : '';
    setFieldState(el.loginPasswordField, 'neutral', hint);
  }
}

function togglePasswordVisibility(inputKey = 'loginPassword', buttonKey = 'togglePasswordBtn'){
  const input = el[inputKey];
  const button = el[buttonKey];
  if (!input) return;
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  if (button) {
    button.textContent = visible ? 'Mostrar' : 'Ocultar';
    button.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
  }
}
function setFieldState(fieldWrap, state = 'neutral', hint = ''){
  if (!fieldWrap) return;
  fieldWrap.classList.remove('is-valid','is-invalid');
  if (state === 'valid') fieldWrap.classList.add('is-valid');
  if (state === 'invalid') fieldWrap.classList.add('is-invalid');
  const hintNode = fieldWrap.querySelector('.field-hint');
  if (hintNode && hint) hintNode.textContent = hint;
}
function validateAuthField(key){
  const value = String(el[key]?.value || '').trim();
  if (key === 'loginName') {
    const hint = 'Informe seu nome completo.';
    if (authMode !== 'register') return setFieldState(el.loginNameField, 'neutral', hint), true;
    if (!value) return setFieldState(el.loginNameField, 'invalid', 'Informe seu nome para criar a conta.'), false;
    if (value.length < 2) return setFieldState(el.loginNameField, 'invalid', 'Digite um nome com pelo menos 2 caracteres.'), false;
    setFieldState(el.loginNameField, 'valid', 'Nome válido.');
    return true;
  }
  if (key === 'loginEmail') {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (!value) return setFieldState(el.loginEmailField, 'invalid', 'Informe seu e-mail.'), false;
    if (!ok) return setFieldState(el.loginEmailField, 'invalid', 'Digite um e-mail válido.'), false;
    setFieldState(el.loginEmailField, 'valid', 'E-mail válido.');
    return true;
  }
  if (key === 'loginPassword') {
    if (!value) return setFieldState(el.loginPasswordField, 'invalid', 'Informe sua senha.'), false;
    // V111 — Appwrite exige mínimo 8 caracteres (não 6)
    if (authMode === 'register' && value.length < 8) return setFieldState(el.loginPasswordField, 'invalid', 'A senha deve ter pelo menos 8 caracteres.'), false;
    if (authMode !== 'register' && value.length < 6) return setFieldState(el.loginPasswordField, 'invalid', 'Informe sua senha.'), false;
    setFieldState(el.loginPasswordField, 'valid', authMode === 'register' ? 'Senha válida.' : 'Senha válida.');
    return true;
  }
  return true;
}
function validateAuthForm(mode = authMode){
  const emailOk = validateAuthField('loginEmail');
  const passwordOk = validateAuthField('loginPassword');
  const nameOk = mode === 'register' ? validateAuthField('loginName') : true;
  return emailOk && passwordOk && nameOk;
}


function startLibraryLoadIfNeeded(force = false){
  if (libraryLoadStarted && !force) return;
  libraryLoadStarted = true;
  showLoading(force ? 'Atualizando biblioteca do Google Drive...' : 'Preparando biblioteca em segundo plano...');
  loadLibrary(force).then(() => {
    readDeepLinks();
    routeInternalPage();
    if (loadJSON(SESSION_KEY, null)?.name) maybeLaunchTour();
  }).catch(error => {
    console.warn('Biblioteca não carregada:', error);
    hideLoading();
  });
}

function isRecoveryRoute(){
  const params = new URLSearchParams(location.search);
  return Boolean(params.get('userId') && params.get('secret'));
}

function showLoginMode(){
  el.resetPasswordBox?.classList.add('hidden');
  document.querySelector('.auth-mode-switch')?.classList.remove('hidden');
  document.querySelector('.login-options-row')?.classList.remove('hidden');
  document.querySelector('.auth-actions')?.classList.remove('hidden');
  document.querySelector('.auth-grid')?.classList.remove('hidden');
  setAuthStatus('', false);
  setAuthMode('login');
  showLogin();
}

function showPasswordRecoveryMode(){
  authMode = 'recovery';
  el.loginScreen?.classList.remove('hidden');
  el.loginScreen?.removeAttribute('inert');
  document.body.classList.add('app-locked');
  document.querySelector('.auth-mode-switch')?.classList.add('hidden');
  document.querySelector('.login-options-row')?.classList.add('hidden');
  document.querySelector('.auth-actions')?.classList.add('hidden');
  document.querySelector('.auth-grid')?.classList.add('hidden');
  el.resetPasswordBox?.classList.remove('hidden');
  setAuthStatus('Informe e confirme sua nova senha para concluir a recuperação.', false);
  setTimeout(() => el.resetPassword?.focus(), 80);
}

function validateRecoveryPassword(){
  const password = String(el.resetPassword?.value || '');
  const confirm = String(el.resetPasswordConfirm?.value || '');
  setFieldState(el.resetPasswordField, password.length >= 6 ? 'valid' : 'invalid', password.length >= 6 ? 'Senha válida.' : 'A senha deve ter pelo menos 6 caracteres.');
  setFieldState(el.resetPasswordConfirmField, confirm && confirm === password ? 'valid' : 'invalid', confirm && confirm === password ? 'As senhas conferem.' : 'As senhas não conferem.');
  return password.length >= 6 && confirm === password;
}

async function confirmPasswordRecovery(){
  if (!validateRecoveryPassword()) return setAuthStatus('Revise os campos destacados para atualizar a senha.', true);
  if (!appwriteAccount) return setAuthStatus('Serviço de autenticação indisponível. Tente novamente.', true);
  const params = new URLSearchParams(location.search);
  const userId = params.get('userId');
  const secret = params.get('secret');
  if (!userId || !secret) return setAuthStatus('Link de recuperação inválido ou expirado.', true);
  try {
    setAuthStatus('Atualizando senha...', false);
    await appwriteAccount.updateRecovery(userId, secret, el.resetPassword.value);
    const cleanUrl = `${location.origin}${location.pathname}`;
    history.replaceState(null, '', cleanUrl);
    el.resetPassword.value = '';
    el.resetPasswordConfirm.value = '';
    showLoginMode();
    setAuthStatus('Senha atualizada com sucesso. Entre com sua nova senha.', false);
  } catch (error) {
    setAuthStatus(translateAppwriteError(error, 'senha'), true);
  }
}

async function initSessionUI(){
  hideLoading();
  if (isRecoveryRoute()) {
    showPasswordRecoveryMode();
    return;
  }
  if (!cloudReady || !appwriteAccount) {
    showLogin();
    setAuthStatus('Serviço de autenticação não configurado. Contate o administrador.', true);
    return;
  }
  try {
    const user = await appwriteAccount.get();
    await applyAuthUser(user);
  } catch {
    showLogin();
  }
}
function setAuthStatus(message = '', isError = false){
  if (!el.authStatus) return;
  el.authStatus.textContent = message;
  el.authStatus.classList.toggle('is-error', Boolean(isError));
  el.authStatus.classList.toggle('is-ok', Boolean(message && !isError));
  el.authStatus.classList.toggle('hidden', !message);
}
function showLoading(message = 'Preparando a plataforma...'){
  if (el.loadingMessage) el.loadingMessage.textContent = message;
  if (authUser) {
    // Depois do login, não bloquear a navegação; carregar biblioteca em segundo plano.
    el.loadingScreen?.classList.add('is-background-loading');
  } else {
    el.loadingScreen?.classList.remove('is-background-loading');
  }
  el.loadingScreen?.classList.remove('hidden');
}
function hideLoading(){
  el.loadingScreen?.classList.add('hidden');
  el.loadingScreen?.classList.remove('is-background-loading');
}
function showLogin(){
  el.resetPasswordBox?.classList.add('hidden');
  document.querySelector('.auth-mode-switch')?.classList.remove('hidden');
  document.querySelector('.login-options-row')?.classList.remove('hidden');
  document.querySelector('.auth-actions')?.classList.remove('hidden');
  document.querySelector('.auth-grid')?.classList.remove('hidden');
  setAuthMode(authMode || 'login');
  el.loginScreen?.classList.remove('hidden');
  el.loginScreen?.removeAttribute('inert');
  document.body.classList.add('app-locked');
  setTimeout(() => el.loginEmail?.focus(), 60);
}
function hideLogin(){
  el.loginScreen?.classList.add('hidden');
  el.loginScreen?.setAttribute('inert', '');
  document.body.classList.remove('app-locked');
}
async function applyAuthUser(user){
  authUser = user;
  const role = user.prefs?.role || '';
  const session = { id: user.$id, name: user.name || user.email, email: user.email, role, at: Date.now() };
  saveJSON(SESSION_KEY, session);
  if (el.userBadge) {
    el.userBadge.innerHTML = `<span class="user-badge-avatar">${esc(getInitials(session.name))}</span><span class="user-badge-text">${esc(role ? `${session.name} • ${role}` : session.name)}</span>`;
    el.userBadge.classList.remove('hidden');
  }
  updateProfileModal();
  el.logoutBtn?.classList.remove('hidden');
  hideLogin();
  // V120 — mostra link Membros no menu se for admin
  updateAdminNavVisibility();
  // V110 — Registra acesso no histórico e no servidor
  recordUsageEvent({
    type: 'user_login',
    userId: user.$id,
    userName: user.name || user.email,
    userEmail: user.email,
    message: `Acesso: ${user.name || user.email} (${user.email})`
  });
  // Envia ping de acesso ao servidor para log centralizado
  fetch('/api/admin/access-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'login',
      userId: user.$id,
      name: user.name || user.email,
      email: user.email,
      at: new Date().toISOString(),
      ua: navigator.userAgent.slice(0, 200)
    })
  }).catch(() => {});
  startLibraryLoadIfNeeded();
  await loadCloudState();
  setupAutoRefresh();
}

// V131.17 — Re-sincroniza os dados quando o usuário volta ao app.
// Resolve o problema de repertórios criados por outra pessoa não aparecerem
// para quem já estava com o app aberto (antes só carregava no boot).
let autoRefreshBound = false;
function setupAutoRefresh(){
  if (autoRefreshBound) return;
  autoRefreshBound = true;

  // Quando a aba/app volta a ficar visível, recarrega o estado da nuvem
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && authUser) {
      // Não recarrega se há alterações locais pendentes (evita sobrescrever)
      const pending = loadJSON('vs_setlists_pending_v1', false);
      if (!pending) {
        loadCloudState().catch(err => console.warn('Auto-refresh falhou:', err));
      }
    }
  });

  // Também recarrega periodicamente a cada 60s enquanto o app está visível
  setInterval(() => {
    if (document.visibilityState === 'visible' && authUser) {
      const pending = loadJSON('vs_setlists_pending_v1', false);
      if (!pending) {
        loadCloudState().catch(() => {});
      }
    }
  }, 60000);
}
async function enterSystem(){
  const email = (el.loginEmail?.value || '').trim();
  const password = (el.loginPassword?.value || '').trim();
  if (!validateAuthForm('login')) return setAuthStatus('Revise os campos destacados para entrar.', true);
  if (!appwriteAccount) return setAuthStatus('Serviço de autenticação indisponível. Tente novamente.', true);
  try {
    setAuthStatus('Entrando...', false);
    await appwriteAccount.createEmailPasswordSession(email, password);
    const user = await appwriteAccount.get();
    await applyAuthUser(user);
    setAuthStatus('', false);
    if (libraryLoaded) maybeLaunchTour();
  } catch (error) {
    setAuthStatus(translateAppwriteError(error, 'login'), true);
  }
}
// V106 — Traduz erros do Appwrite (em inglês) para português claro.
// Cobre os erros mais comuns que o usuário pode encontrar nos fluxos de
// login, cadastro e recuperação de senha.
function translateAppwriteError(error, context = 'geral'){
  const msg = String(error?.message || error || '').toLowerCase();
  const code = error?.code || error?.status || 0;

  // --- Cadastro ---
  if (msg.includes('already exists') || msg.includes('already been taken') || code === 409) {
    return 'Este e-mail já possui um cadastro. Tente entrar ou recuperar sua senha.';
  }
  if (msg.includes('password must be') || msg.includes('password should') ||
      msg.includes('at least 8') || msg.includes('password must have') ||
      msg.includes('weak password') || msg.includes('password is too short')) {
    return 'A senha deve ter pelo menos 8 caracteres.';
  }
  if (msg.includes('password must include') || msg.includes('password must contain')) {
    return 'A senha não atende aos requisitos de segurança. Use pelo menos 8 caracteres.';
  }
  if (msg.includes('invalid email') || msg.includes('email format')) {
    return 'O e-mail informado não é válido.';
  }
  if (msg.includes('name is required') || msg.includes('name must')) {
    return 'O nome é obrigatório para o cadastro.';
  }

  // --- Login ---
  if (msg.includes('invalid credentials') || msg.includes('wrong password') ||
      msg.includes('incorrect password') || code === 401) {
    return 'E-mail ou senha incorretos. Verifique e tente novamente.';
  }
  if (msg.includes('user not found') || msg.includes('no user') || code === 404) {
    return 'E-mail não encontrado. Verifique ou crie um novo cadastro.';
  }
  if (msg.includes('too many requests') || msg.includes('rate limit') || code === 429) {
    return 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
  }
  if (msg.includes('session') && msg.includes('not found')) {
    return 'Sua sessão expirou. Faça login novamente.';
  }
  if (msg.includes('blocked') || msg.includes('disabled') || msg.includes('suspended')) {
    return 'Conta bloqueada ou desativada. Entre em contato com o administrador.';
  }

  // --- Recuperação de senha ---
  if (msg.includes('recovery') && (msg.includes('not found') || msg.includes('expired'))) {
    return 'Link de recuperação expirado ou inválido. Solicite um novo.';
  }
  if (msg.includes('token') && msg.includes('expired')) {
    return 'O código de recuperação expirou. Solicite um novo e-mail de recuperação.';
  }

  // --- Rede / servidor ---
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch') ||
      msg.includes('networkerror') || code === 0) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  }
  if (code >= 500) {
    return 'Erro no servidor. Tente novamente em alguns instantes.';
  }

  // --- Fallback por contexto ---
  const fallbacks = {
    login:    'Não foi possível entrar. Verifique e-mail e senha.',
    cadastro: 'Não foi possível criar o cadastro. Tente novamente.',
    recuperar:'Não foi possível enviar o e-mail de recuperação.',
    senha:    'Não foi possível atualizar a senha. Tente novamente.',
    geral:    'Ocorreu um erro inesperado. Tente novamente.'
  };
  return fallbacks[context] || fallbacks.geral;
}

async function createAccount(){
  const name = (el.loginName?.value || '').trim();
  const email = (el.loginEmail?.value || '').trim();
  const password = (el.loginPassword?.value || '').trim();
  if (!validateAuthForm('register')) return setAuthStatus('Revise os campos destacados para concluir o cadastro.', true);
  if (!appwriteAccount) return setAuthStatus('Serviço de autenticação indisponível. Tente novamente.', true);
  try {
    setAuthStatus('Criando cadastro...', false);
    // V111 — Gera ID único com fallback: usa Appwrite.ID se disponível,
    // caso contrário gera um UUID compatível localmente.
    const uniqueId = window.Appwrite?.ID?.unique
      ? window.Appwrite.ID.unique()
      : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    await appwriteAccount.create(uniqueId, email, password, name);
    if (el.loginPassword) el.loginPassword.value = '';
    setAuthMode('login');
    validateAuthField('loginEmail');
    validateAuthField('loginPassword');
    setAuthStatus('Cadastro criado com sucesso! Informe sua senha e clique em “Entrar”.', false);
    toast('Cadastro criado. Faça login para acessar sua conta.');
    // V110 — Log de novo cadastro no servidor
    fetch('/api/admin/access-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'register',
        name,
        email,
        at: new Date().toISOString(),
        ua: navigator.userAgent.slice(0, 200)
      })
    }).catch(() => {});
    setTimeout(() => el.loginPassword?.focus(), 80);
  } catch (error) {
    const msg = translateAppwriteError(error, 'cadastro');
    setAuthStatus(msg, true);
    // V106 — Se e-mail duplicado: destaca o campo e orienta o usuário.
    if (msg.includes('já possui um cadastro')) {
      if (typeof setFieldState === 'function' && el.loginEmailField)
        setFieldState(el.loginEmailField, 'error', 'Este e-mail já tem cadastro.');
      if (el.loginNote) el.loginNote.textContent = 'Já tem conta? Clique em "← Voltar ao login" e entre com sua senha, ou use "Esqueci minha senha".';
    }
  }
}

function getInitials(name = ''){
  return String(name || 'U').trim().split(/\s+/).filter(Boolean).slice(0,2).map(p => p[0]).join('').toUpperCase() || 'U';
}
function openProfileModal(){
  updateProfileModal();
  el.profileModal?.classList.remove('hidden');
  document.body.classList.add('app-locked');
}
function closeProfileModal(){
  el.profileModal?.classList.add('hidden');
  if (el.loginScreen?.classList.contains('hidden')) document.body.classList.remove('app-locked');
}
function updateProfileModal(){
  if (!authUser) return;
  const session = loadJSON(SESSION_KEY, {});
  const name = authUser.name || session.name || authUser.email || 'Usuário';
  const email = authUser.email || session.email || '';
  const role = session.role || authUser.prefs?.role || 'Não informado';
  if (el.profileAvatar) el.profileAvatar.textContent = getInitials(name);
  if (el.profileName) el.profileName.textContent = name;
  if (el.profileEmail) el.profileEmail.textContent = email;
  if (el.profileRole) el.profileRole.textContent = role || 'Não informado';
  if (el.profilePermission) el.profilePermission.textContent = isScheduleAdmin() ? 'Administrador' : 'Usuário';
  if (el.profileFavorites) el.profileFavorites.textContent = String(favorites?.length || 0);
  if (el.profileSetlists) el.profileSetlists.textContent = String(setlists?.length || 0);
}
async function recoverPassword(){
  const email = (el.loginEmail?.value || '').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    validateAuthField('loginEmail');
    return setAuthStatus('Informe um e-mail válido para recuperar a senha.', true);
  }
  if (!appwriteAccount) return setAuthStatus('Serviço de autenticação indisponível. Tente novamente.', true);
  try {
    setAuthStatus('Enviando instruções de recuperação...', false);
    const recoveryUrl = `${location.origin}${location.pathname}`;
    await appwriteAccount.createRecovery(email, recoveryUrl);
    setAuthStatus('Enviamos as instruções de recuperação para o e-mail informado.', false);
  } catch (error) {
    setAuthStatus(translateAppwriteError(error, 'recuperar'), true);
  }
}
async function logoutSession(){
  try { await appwriteAccount?.deleteSession('current'); } catch {}
  authUser = null;
  localStorage.removeItem(SESSION_KEY);
  if (el.userBadge) {
    el.userBadge.innerHTML = '';
    el.userBadge.classList.add('hidden');
  }
  el.logoutBtn?.classList.add('hidden');
  showLogin();
  renderSchedule();
}
async function loadCloudState(){
  if (!authUser) return;
  try {
    const [shared, userState, cloudMembers, cloudSchedule, cloudHistory, collectionSetlists] = await Promise.all([
      getSharedState('setlists'),
      getUserState('favorites'),
      getSharedState('members'),
      getSharedState('monthlySchedule'),
      getSharedState('usageHistory'),
      loadSetlistsFromCollection()   // V131.18 — modelo novo (por-documento)
    ]);

    // V131.18 — Prioriza a collection nova (documentos individuais).
    // Se ela existe e tem dados, é a fonte de verdade. Se estiver vazia mas o
    // formato antigo (array) tiver dados, MIGRA automaticamente para a collection.
    const localPendingFlag = loadJSON('vs_setlists_pending_v1', false);

    if (Array.isArray(collectionSetlists) && collectionSetlists.length > 0) {
      // V131.21 — CORREÇÃO DE BUG: a table (collection) é a ÚNICA fonte de
      // verdade sobre QUAIS repertórios existem. Antes, fazíamos um "merge"
      // que juntava a table com o cache local do navegador — isso causava um
      // repertório JÁ EXCLUÍDO por outra pessoa "voltar à tela", porque ele
      // ainda estava salvo no localStorage deste dispositivo.
      // Agora: usamos a lista da table como base. Só preservamos um repertório
      // local que NÃO está na table se ele estiver genuinamente pendente de
      // sincronização (acabou de ser criado agora mesmo, ainda enviando).
      const collectionIds = new Set(collectionSetlists.map(s => s.id));
      const aindaEnviando = setlists.filter(s =>
        s && s.id && pendingNewSetlistIds.has(s.id) && !collectionIds.has(s.id)
      );
      setlists = [...collectionSetlists, ...aindaEnviando];
      saveJSON('vs_setlists_v1', setlists);
    } else if (Array.isArray(shared) && shared.length > 0) {
      // Collection vazia mas formato antigo tem dados → MIGRA uma vez
      console.info('[setlists] Migrando repertórios do formato antigo para a collection nova...');
      setlists = mergeSetlistsDefensive(setlists, shared);
      saveJSON('vs_setlists_v1', setlists);
      // Envia cada repertório para a collection nova (migração)
      for (const s of setlists) {
        saveSingleSetlist(s).catch(() => {});
      }
    } else if (Array.isArray(shared)) {
      // Sem dados em nenhum lado, mas mantém compatibilidade
      if (localPendingFlag) {
        setSharedState('setlists', setlists).catch(err => console.warn('Resync pendente falhou:', err));
      } else {
        setlists = mergeSetlistsDefensive(setlists, shared);
        saveJSON('vs_setlists_v1', setlists);
      }
    }
    // Limpa o flag de pending após carregar (as escritas por-documento são atômicas)
    if (localPendingFlag) { setlistsPendingCount = 0; saveJSON('vs_setlists_pending_v1', false); }

    if (Array.isArray(userState)) favorites = userState;
    if (Array.isArray(cloudMembers) && cloudMembers.length) members = normalizeMembers(cloudMembers);
    if (Array.isArray(cloudSchedule) && cloudSchedule.length) scheduleRows = normalizeScheduleRows(cloudSchedule);
    if (Array.isArray(cloudHistory)) {
      // V131.7 — Migra histórico antigo: remove o objeto 'user' pesado de
      // eventos salvos em versões anteriores, convertendo para o campo 'u'
      // (string curta). Isso reduz o tamanho e evita o erro 400 do Appwrite.
      usageHistory = cloudHistory.map(e => {
        if (e && e.user && typeof e.user === 'object') {
          const { user, id, ...rest } = e;
          return { ...rest, u: user.name || user.email || '' };
        }
        return e;
      });
    }
    // V112 — carrega mapa multi-mês da nuvem
    try {
      const cloudMonths = await getSharedState('allScheduleMonths');
      if (cloudMonths && typeof cloudMonths === 'object' && !Array.isArray(cloudMonths)) {
        allScheduleMonths = { ...DEFAULT_ALL_MONTHS, ...cloudMonths };
        scheduleRows = allScheduleMonths[activeScheduleMonth] || scheduleRows;
        saveJSON('vs_schedule_months_v1', allScheduleMonths);
      }
    } catch(_) {}
    saveJSON('vs_setlists_v1', setlists);
    saveJSON('vs_favorites_v1', favorites);
    saveJSON('vs_members_v1', members);
    saveJSON('vs_schedule_rows_v1', scheduleRows);
    saveJSON('vs_usage_history_v51', usageHistory);
    // V131.7 — Se o histórico carregado da nuvem ainda estiver acima do limite
    // (versões antigas com eventos pesados), poda e re-salva a versão enxuta.
    if (Array.isArray(cloudHistory) && JSON.stringify(usageHistory).length > 45000) {
      saveUsageHistoryState();
    }
    await seedScheduleDataIfNeeded(cloudMembers, cloudSchedule);
    updateStats();
    updateFavoriteCount();
    populateScheduleFilters();
    renderSchedule();
    renderSetlists();
    render();
  } catch (error) {
    console.warn('Estado online não carregado:', error);
    toast('Sem sincronização online. Usando dados salvos no dispositivo.');
  }
}
async function getSharedState(key){
  const res = await fetch(`/api/appwrite/state/${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.value;
}
// V100 — Merge defensivo de setlists local + remoto.
// Para cada setlist com mesmo id, escolhe a versão com MAIS músicas
// (mais provável de ser a mais recente). Para setlists só locais ou só remotos,
// preserva ambos. Protege contra race conditions onde o servidor responde com
// versão antiga durante adições rápidas no mobile.
function mergeSetlistsDefensive(local, remote){
  if (!Array.isArray(local)) return remote;
  if (!Array.isArray(remote)) return local;
  const byId = new Map();
  for (const r of remote) {
    if (r && r.id) byId.set(r.id, { remote: r, local: null });
  }
  for (const l of local) {
    if (!l || !l.id) continue;
    const entry = byId.get(l.id) || { remote: null, local: null };
    entry.local = l;
    byId.set(l.id, entry);
  }
  const merged = [];
  for (const { local: l, remote: r } of byId.values()) {
    if (l && r) {
      const lCount = (l.trackIds || []).length;
      const rCount = (r.trackIds || []).length;
      const lAt = Date.parse(l.updatedAt || '') || 0;
      const rAt = Date.parse(r.updatedAt || '') || 0;

      // V126.1 — Regra de merge revisada:
      // 1) Mais músicas ganha (protege contra race condition de adição rápida).
      if (lCount > rCount) {
        // Local tem mais músicas mas preserva eventDate/archived do remoto se o
        // local não tiver — evita perder dados de data adicionados em outro device.
        const winner = { ...l };
        if (!winner.eventDate && r.eventDate) winner.eventDate = r.eventDate;
        if (!winner.archived && r.archived) winner.archived = r.archived;
        merged.push(winner);
      } else if (rCount > lCount) {
        merged.push(r);
      } else {
        // 2) Empate de músicas: prefere o mais recente pelo updatedAt.
        // MAS: se um tem eventDate e o outro não, prefere o que tem —
        // independente do updatedAt (eventDate pode ter sido adicionado
        // num device sem alterar tracks, mantendo updatedAt igual).
        const lHasDate = !!l.eventDate;
        const rHasDate = !!r.eventDate;
        let winner;
        if (rHasDate && !lHasDate) {
          winner = { ...l, eventDate: r.eventDate, archived: r.archived || l.archived };
        } else if (lHasDate && !rHasDate) {
          winner = l;
        } else {
          // Ambos têm ou ambos não têm data: pega o mais recente
          winner = lAt >= rAt ? l : r;
        }
        merged.push(winner);
      }
    } else {
      merged.push(l || r);
    }
  }
  return merged;
}

// V131.8 — Limite do Appwrite: o atributo "value" aceita no máx 50.000 chars
// após JSON.stringify. Verificamos ANTES de enviar para dar erro claro e
// evitar o 400 genérico. Margem de segurança de 49.000.
const APPWRITE_VALUE_MAX = 49000;

function checkStateSize(key, value){
  const size = JSON.stringify(value ?? null).length;
  if (size > APPWRITE_VALUE_MAX) {
    console.warn(`[sync] "${key}" tem ${size} chars (limite ${APPWRITE_VALUE_MAX}). Não sincronizado para evitar erro.`);
    return false;
  }
  return true;
}

async function setSharedState(key, value){
  if (!authUser) return;
  // Bloqueia envio se exceder o limite — evita erro 400 que travava o app
  if (!checkStateSize(key, value)) {
    throw new Error(`Estado "${key}" excede o limite de tamanho e não foi sincronizado.`);
  }
  const res = await fetch(`/api/appwrite/state/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, updatedBy: authUser.name || authUser.email })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function getAuthJwt(){
  if (!appwriteAccount) throw new Error('Appwrite Auth não inicializado.');
  const data = await appwriteAccount.createJWT();
  return data.jwt;
}
function isScheduleAdmin(){
  const email = String(authUser?.email || '').toLowerCase();
  return Boolean(email && cloudAdminEmails.includes(email));
}
function currentUserIdentity(){
  return {
    id: authUser?.$id || '',
    email: String(authUser?.email || '').toLowerCase(),
    name: authUser?.name || authUser?.email || ''
  };
}
function getSetlistCreatorId(setlist){
  return setlist?.createdById || setlist?.creatorId || setlist?.created_by || '';
}
function getSetlistCreatorEmail(setlist){
  return String(setlist?.createdByEmail || setlist?.creatorEmail || setlist?.created_by_email || '').toLowerCase();
}
function getSetlistCreatorName(setlist){
  return setlist?.createdByName || setlist?.creatorName || setlist?.created_by_name || 'Criador não identificado';
}
function isSetlistOwner(setlist){
  if (!authUser || !setlist) return false;
  const user = currentUserIdentity();
  const creatorId = getSetlistCreatorId(setlist);
  const creatorEmail = getSetlistCreatorEmail(setlist);
  return Boolean((creatorId && creatorId === user.id) || (creatorEmail && creatorEmail === user.email));
}
function canDeleteSetlist(setlist){
  // V113 — admin do sistema pode excluir qualquer repertório
  return isSetlistOwner(setlist) || isScheduleAdmin();
}
function canEditSetlist(setlist){
  // V113 — admin do sistema pode editar qualquer repertório
  return isSetlistOwner(setlist) || isScheduleAdmin();
}

function canCreateSetlists(){
  return Boolean(authUser);
}
function persistActiveSetlist(){
  saveJSON(ACTIVE_SETLIST_KEY, activeSetlistId || '');
}
function persistPendingPaletteSetlist(){
  saveJSON(PENDING_PALETTE_SETLIST_KEY, pendingPaletteSetlistId || '');
}
function getPendingPaletteSetlist(){
  return setlists.find(s => s.id === pendingPaletteSetlistId) || null;
}
function setPendingPaletteSetlist(id){
  pendingPaletteSetlistId = id || '';
  persistPendingPaletteSetlist();
  renderPaletteSelectionTarget();
}
function clearPendingPaletteSetlist(){
  pendingPaletteSetlistId = '';
  persistPendingPaletteSetlist();
  renderPaletteSelectionTarget();
}
function startPaletteSelectionForSetlist(setlist, returnTarget='repertorios'){
  if (!setlist) return;
  setPendingPaletteSetlist(setlist.id);
  pendingPaletteReturnTarget = returnTarget || 'repertorios';
  closeSetlistDetail();
  closeSetlistReviewModal();
  location.hash = '#paletas';
  routeInternalPage();
  render();
  toast(`Escolha a paleta para o repertório "${setlist.name}".`);
}
function getActiveSetlist(){
  return setlists.find(s => s.id === activeSetlistId) || null;
}
function getActiveEditableSetlist(){
  const setlist = getActiveSetlist();
  return canEditSetlist(setlist) ? setlist : null;
}
function setActiveSetlist(id){
  activeSetlistId = id || '';
  persistActiveSetlist();
  renderActiveSetlistBanner();
}

// V131.11 — Inicia o fluxo de adicionar músicas a um repertório existente.
// Torna o repertório ativo e leva o usuário à biblioteca, onde cada música
// tem o botão de adicionar ao repertório ativo.
function startAddSongsToSetlist(id){
  const setlist = setlists.find(s => s.id === id);
  if (!setlist) return;
  if (!canEditSetlist(setlist)) {
    toast('Somente quem criou este repertório (ou um administrador) pode adicionar músicas.');
    return;
  }
  setActiveSetlist(id);
  closeSetlistDetail();
  location.hash = '#biblioteca';
  routeInternalPage();
  render();
  toast(`Repertório ativo: "${setlist.name}". Toque ➕ nas músicas para adicioná-las.`);
}
function clearActiveSetlist(){
  activeSetlistId = '';
  persistActiveSetlist();
  renderActiveSetlistBanner();
}
function concludeActiveSetlist(){
  const active = getActiveSetlist();
  if (!active) {
    toast('Nenhum repertório ativo para concluir.');
    clearActiveSetlist();
    return;
  }
  openSetlistReviewModal(active);
}
function reconcileActiveSetlist(){
  const active = getActiveSetlist();
  if (!active) {
    if (activeSetlistId) clearActiveSetlist();
    return null;
  }
  if (!canEditSetlist(active)) {
    clearActiveSetlist();
    return null;
  }
  return active;
}
function isTrackPresentInSetlist(setlist, trackId){
  if (!setlist || !trackId) return false;
  return (setlist.trackIds || []).some(entry => getSetlistEntryTrackId(entry) === trackId);
}
function pulseAddedTrack(trackId){
  document.querySelectorAll(`.track-card[data-id="${CSS.escape(String(trackId))}"]`).forEach(card => {
    card.classList.remove('added-pulse');
    void card.offsetWidth;
    card.classList.add('added-pulse');
    const btn = card.querySelector('.setlist-btn .action-icon-glyph');
    if (btn) {
      const previous = btn.textContent;
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = previous; }, 1000);
    }
    setTimeout(() => card.classList.remove('added-pulse'), 1400);
  });
}
function renderActiveSetlistBanner(){
  if (!el.activeSetlistBanner) return;
  const active = reconcileActiveSetlist();
  if (!active) {
    el.activeSetlistBanner.classList.add('hidden');
    el.activeSetlistMiniBar?.classList.add('hidden');
    return;
  }
  el.activeSetlistBanner.classList.remove('hidden');
  el.activeSetlistMiniBar?.classList.remove('hidden');
  el.activeSetlistName.textContent = active.name;
  if (el.activeSetlistMiniName) el.activeSetlistMiniName.textContent = active.name;
  const count = countValidSetlistTracks(active);
  el.activeSetlistMeta.textContent = `${count} música(s) no repertório.`;
}

function renderPaletteSelectionTarget(){
  if (!el.paletteSelectionTarget) return;
  const target = getPendingPaletteSetlist();
  if (!target) {
    el.paletteSelectionTarget.classList.add('hidden');
    el.paletteSelectionTarget.innerHTML = '';
    return;
  }
  el.paletteSelectionTarget.classList.remove('hidden');
  el.paletteSelectionTarget.innerHTML = `<strong>Escolha a paleta do repertório:</strong> <span>${esc(target.name)}</span>`;
}

function renderSetlistReviewTracks(setlist){
  if (!el.setlistReviewTracks) return;
  const tracks = mapSetlistTracks(setlist);
  if (!tracks.length) {
    el.setlistReviewTracks.innerHTML = '<div class="empty">Este repertório ainda não possui músicas.</div>';
    return;
  }
  el.setlistReviewTracks.innerHTML = tracks.map((track, index) => `
    <div class="reorder-item is-readonly">
      <div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1">
        <div>
          <strong>${index + 1}. ${esc(track.name)}</strong>
          <span>${esc(track.singer)} • Tom original ${esc(formatKeyLabel(track.key || '—'))}${track.repertoireTone ? ` • <span class="repertoire-tone-badge">Tom do repertório: ${esc(formatKeyLabel(track.repertoireTone))}</span>` : ''}</span>
        </div>
      </div>
    </div>
  `).join('');
}
function openSetlistReviewModal(setlist){
  if (!setlist || !el.setlistReviewModal) return;
  el.setlistReviewTitle.textContent = setlist.name;
  const count = countValidSetlistTracks(setlist);
  el.setlistReviewMeta.textContent = `${count} música(s) • Confira a ordem e clique em OK para concluir.`;
  renderSetlistReviewTracks(setlist);
  el.setlistReviewModal.classList.remove('hidden');
}
function closeSetlistReviewModal(){
  el.setlistReviewModal?.classList.add('hidden');
}
function confirmActiveSetlistConclusion(){
  const active = getActiveSetlist();
  const name = active?.name || '';
  closeSetlistReviewModal();
  if (!active) {
    clearActiveSetlist();
    return;
  }
  // V131.17 — Paleta agora é OPCIONAL. Conclui o repertório e abre a escolha
  // de paleta, mas o usuário pode fechar sem escolher. Um aviso lembra que
  // a paleta ainda não foi definida.
  clearActiveSetlist();
  const temPaleta = active.paletteImage && active.paletteTitle;
  if (name) {
    toast(temPaleta
      ? `Repertório "${name}" concluído.`
      : `Repertório "${name}" concluído. Falta escolher a paleta de cores (opcional).`);
  }
  // Abre a escolha de paleta como sugestão (não obrigatória)
  startPaletteSelectionForSetlist(active, 'repertorios');
}
function openPaletteModal(title, imagePath, paletteId=''){
  if (!el.paletteModal) return;
  el.paletteModalTitle.textContent = title || 'Paleta de cores';
  el.paletteModalImage.src = imagePath;
  el.paletteModalImage.alt = title || 'Paleta de cores';
  el.paletteModal.dataset.paletteId = paletteId || '';
  el.paletteModal.dataset.paletteTitle = title || 'Paleta de cores';
  el.paletteModal.dataset.paletteImage = imagePath || '';
  if (el.paletteModalUseBtn) {
    el.paletteModalUseBtn.disabled = false;
    el.paletteModalUseBtn.textContent = getPendingPaletteSetlist() ? 'Usar esta paleta' : 'Escolher repertório';
  }
  el.paletteModal.classList.remove('hidden');
}
function handlePaletteUse(palette){
  if (!palette || !palette.image || !palette.title) return;
  const target = getPendingPaletteSetlist() || getActiveEditableSetlist();
  if (target) {
    applyPaletteToSetlist(target, palette);
    return;
  }
  openPaletteChooseSetlistModal(palette);
}

function openPaletteChooseSetlistModal(palette, mode = 'apply'){
  if (!el.paletteChooseSetlistModal) return;
  pendingPaletteChoice = palette;
  const editable = setlists.filter(s => canEditSetlist(s));
  el.paletteChooseTitle.textContent = mode === 'share' ? 'Escolha uma paleta antes de compartilhar' : `Usar ${palette.title || 'paleta'} no repertório`;
  el.paletteChooseDescription.textContent = editable.length
    ? 'Selecione o repertório que receberá esta paleta. Cada repertório pode ter somente uma paleta ativa.'
    : 'Você ainda não possui repertórios editáveis. Crie um repertório ou peça ao criador para alterar a paleta.';
  el.paletteChoosePreview.innerHTML = `<img src="${esc(palette.image)}" alt="${esc(palette.title || 'Paleta')}"><div><strong>${esc(palette.title || 'Paleta')}</strong><span>Selecione abaixo o repertório de destino.</span></div>`;
  if (!editable.length) {
    el.paletteChooseList.innerHTML = '<div class="empty">Nenhum repertório editável disponível para sua conta.</div>';
  } else {
    el.paletteChooseList.innerHTML = editable.map(s => {
      const current = s.paletteTitle ? `<span>Paleta atual: ${esc(s.paletteTitle)}</span>` : '<span>Sem paleta definida</span>';
      return `<div class="stack-item palette-target-item">
        <div><strong>${esc(s.name)}</strong>${current}</div>
        <button class="mini-btn choose-palette-setlist" data-id="${esc(s.id)}">Selecionar</button>
      </div>`;
    }).join('');
  }
  el.paletteChooseList.querySelectorAll('.choose-palette-setlist').forEach(btn => btn.addEventListener('click', () => {
    const setlist = setlists.find(s => s.id === btn.dataset.id);
    if (setlist && pendingPaletteChoice) applyPaletteToSetlist(setlist, pendingPaletteChoice);
  }));
  closePaletteModal();
  el.paletteChooseSetlistModal.classList.remove('hidden');
}

function closePaletteChooseSetlistModal(){
  el.paletteChooseSetlistModal?.classList.add('hidden');
  pendingPaletteChoice = null;
}

function confirmPaletteReplaceIfNeeded(setlist, palette){
  if (!setlist?.paletteTitle) return true;
  if (String(setlist.paletteId || '') === String(palette.id || '')) return true;
  return confirm(`O repertório "${setlist.name}" já possui a paleta "${setlist.paletteTitle}". Deseja trocar para "${palette.title}"?`);
}

function applyPaletteToSetlist(setlist, palette){
  if (!setlist || !palette) return;
  if (!canEditSetlist(setlist)) {
    toast('Somente quem criou este repertório pode definir ou trocar a paleta.');
    return;
  }
  if (!confirmPaletteReplaceIfNeeded(setlist, palette)) return;
  setlist.paletteId = String(palette.id || '');
  setlist.paletteTitle = palette.title || '';
  setlist.paletteImage = palette.image || '';
  setlist.updatedAt = new Date().toISOString();
  saveSetlistsState();
  updateStats();
  renderSetlists();
  render();
  const shareAfter = pendingPaletteShareSetlistId && String(pendingPaletteShareSetlistId) === String(setlist.id);
  closePaletteModal();
  closePaletteChooseSetlistModal();
  clearPendingPaletteSetlist();
  clearActiveSetlist();
  pendingPaletteReturnTarget = '';
  const setlistName = setlist.name;
  if (shareAfter) {
    pendingPaletteShareSetlistId = '';
    copyText(buildSetlistShareUrl(setlist.id), 'Paleta definida e link do repertório copiado.');
  } else {
    toast(`Paleta "${palette.title}" definida para o repertório "${setlistName}".`);
  }
  if (currentSetlistDetailId && String(currentSetlistDetailId) === String(setlist.id)) openSetlistDetail(setlist.id);
}

// ============================================================
// V125 — Compartilhamento com arte gerada via Canvas
// ============================================================

let shareSetlistTarget = null; // setlist sendo compartilhado

function openShareSetlistModal(setlist){
  if (!setlist) return;
  shareSetlistTarget = setlist;

  if (el.shareSetlistModalTitle) el.shareSetlistModalTitle.textContent = setlist.name;
  if (el.shareSetlistModalMeta) {
    const trackCount = countValidSetlistTracks(setlist);
    const dateLabel = setlist.eventDate
      ? new Date(setlist.eventDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })
      : 'Sem data definida';
    el.shareSetlistModalMeta.textContent = `${trackCount} música(s) • ${dateLabel}`;
  }

  // Botão compartilhar nativo — visível sempre (fallback para copiar link se não disponível)
  if (el.shareSetlistNativeShare) el.shareSetlistNativeShare.style.display = '';

  if (el.shareSetlistModal) el.shareSetlistModal.classList.remove('hidden');
}

function closeShareSetlistModalFn(){
  if (el.shareSetlistModal) el.shareSetlistModal.classList.add('hidden');
  shareSetlistTarget = null;
}

function bindShareSetlistModal(){
  el.closeShareSetlistModal?.addEventListener('click', closeShareSetlistModalFn);
  el.shareSetlistModal?.addEventListener('click', e => {
    if (e.target === el.shareSetlistModal) closeShareSetlistModalFn();
  });
  el.shareSetlistCopyLink?.addEventListener('click', () => {
    if (!shareSetlistTarget) return;
    copyText(buildSetlistShareUrl(shareSetlistTarget.id), 'Link do repertório copiado!');
  });
  el.shareSetlistNativeShare?.addEventListener('click', async () => {
    if (!shareSetlistTarget) return;
    const url = buildSetlistShareUrl(shareSetlistTarget.id);
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareSetlistTarget.name,
          text: `Repertório do culto: ${shareSetlistTarget.name}`,
          url
        });
      } catch(e) {
        if (e.name !== 'AbortError') copyText(url, 'Link copiado!');
      }
    } else {
      copyText(url, 'Link do repertório copiado!');
    }
  });
}

// Gera a arte do repertório no Canvas e retorna o canvas element
function shareSetlistWithPaletteCheck(setlist){
  if (!setlist) return;
  // V125 — Abre o modal de compartilhamento com opções de link + arte
  openShareSetlistModal(setlist);
}

function applyPaletteToPendingSetlist(palette){
  const setlist = getPendingPaletteSetlist() || getActiveEditableSetlist();
  if (!setlist) {
    handlePaletteUse(palette);
    return;
  }
  applyPaletteToSetlist(setlist, palette);
}

function closePaletteModal(){
  el.paletteModal?.classList.add('hidden');
}
function activateSetlistAndOpenLibrary(setlist){
  if (!setlist) return;
  setActiveSetlist(setlist.id);
  closeSetlistModal();
  location.hash = '#biblioteca';
  routeInternalPage();
  render();
  recordUsageEvent({ type: 'setlist_active', setlistId: setlist.id, setlistName: setlist.name, message: `Repertório ativo: "${setlist.name}".` });
  toast(`Repertório “${setlist.name}” ativo. Adicione músicas na biblioteca.`);
}
function addTrackToSetlist(setlist, track, toneInfo = { semitones: 0, tone: '' }, options = {}){
  if (!setlist || !track) return false;
  if (!canEditSetlist(setlist)) {
    toast('Somente quem criou este repertório pode editá-lo.');
    return false;
  }
  const entry = makeSetlistEntry(track, toneInfo);
  if (setlistHasEntry(setlist, entry)) {
    toast('Esta música já está neste repertório neste mesmo tom.');
    return false;
  }
  setlist.trackIds.push(entry);
  setlist.updatedAt = new Date().toISOString();
  saveSetlistsState();
  updateStats();
  renderSetlists();
  renderSetlistOptions();
  render();
  pulseAddedTrack(track.id);
  if (options.closeModal) closeSetlistModal();
  recordUsageEvent({ type: 'setlist_updated', setlistId: setlist.id, setlistName: setlist.name, trackCount: setlist.trackIds.length, message: `Música adicionada ao repertório "${setlist.name}".` });
  toast(options.toastMessage || 'Música adicionada ao repertório.');
  return true;
}
async function setAdminSharedState(key, value){
  if (!authUser) throw new Error('Faça login para salvar.');
  if (!checkStateSize(key, value)) {
    throw new Error(`A escala "${key}" ficou muito grande para sincronizar. Considere remover meses antigos.`);
  }
  const jwt = await getAuthJwt();
  const res = await fetch(`/api/appwrite/admin/state/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ value })
  });
  if (!res.ok) {
    let message = await res.text();
    try { message = JSON.parse(message).error || message; } catch {}
    throw new Error(message);
  }
  return res.json();
}
function normalizeMembers(list){
  const map = new Map();
  [...DEFAULT_MEMBERS, ...(list || [])].forEach(name => {
    const text = String(name || '').trim();
    if (!text) return;
    const key = normalize(text);
    if (!map.has(key) || /[áéíóúãõâêôç]/i.test(text)) map.set(key, text);
  });
  return [...map.values()].sort((a,b) => normalize(a).localeCompare(normalize(b), 'pt-BR'));
}
function normalizeScheduleRows(rows){
  if (!Array.isArray(rows)) return DEFAULT_scheduleRows.map(row => ({...row}));
  return rows.map(row => ({
    day: row.day || '', date: row.date || '',
    minister: row.minister || '', back1: row.back1 || '', back2: row.back2 || '', back3: row.back3 || '',
    bass: row.bass || '', drums: row.drums || '', guitar: row.guitar || '', keyboard: row.keyboard || '', acoustic: row.acoustic || '', sound: row.sound || ''
  }));
}
async function seedScheduleDataIfNeeded(cloudMembers, cloudSchedule){
  if (!isScheduleAdmin()) return;
  const tasks = [];
  if (!Array.isArray(cloudMembers) || !cloudMembers.length) tasks.push(setAdminSharedState('members', members));
  if (!Array.isArray(cloudSchedule) || !cloudSchedule.length) tasks.push(setAdminSharedState('monthlySchedule', scheduleRows));
  if (!tasks.length) return;
  try {
    await Promise.all(tasks);
    toast('Escala inicial configurada com sucesso.');
  } catch (error) {
    console.warn('Dados iniciais da escala não sincronizados:', error);
  }
}
async function saveScheduleState(showToast = false){
  if (!isScheduleAdmin()) {
    toast('Você não tem permissão para editar a escala.');
    return;
  }
  try {
    setScheduleEditStatus('Salvando escala...', 'saving');
    // V112 — salva o mês ativo no mapa e persiste tudo
    allScheduleMonths[activeScheduleMonth] = scheduleRows;
    await Promise.all([
      setAdminSharedState('members', members),
      setAdminSharedState('monthlySchedule', scheduleRows),
      setAdminSharedState('allScheduleMonths', allScheduleMonths)
    ]);
    scheduleDirty = false;
    saveJSON('vs_members_v1', members);
    saveJSON('vs_schedule_rows_v1', scheduleRows);
    saveJSON('vs_schedule_months_v1', allScheduleMonths);
    saveJSON('vs_usage_history_v51', usageHistory);
    setScheduleEditStatus('Escala salva com sucesso.', 'admin');
    if (showToast) toast('Escala salva com sucesso.');
  } catch (error) {
    console.error(error);
    setScheduleEditStatus(`Erro ao salvar: ${error.message}`, 'error');
    toast('Não foi possível salvar a escala. Tente novamente.');
  }
}
function setScheduleEditStatus(message, mode = ''){
  if (!el.scheduleEditStatus) return;
  el.scheduleEditStatus.textContent = message;
  el.scheduleEditStatus.classList.toggle('is-admin', mode === 'admin');
  el.scheduleEditStatus.classList.toggle('is-saving', mode === 'saving');
}
async function getUserState(key){
  if (!authUser) return null;
  const res = await fetch(`/api/appwrite/user-state/${encodeURIComponent(authUser.$id)}/${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.value;
}
async function setUserState(key, value){
  if (!authUser) return;
  if (!checkStateSize(key, value)) {
    throw new Error(`Estado "${key}" excede o limite de tamanho e não foi sincronizado.`);
  }
  const res = await fetch(`/api/appwrite/user-state/${encodeURIComponent(authUser.$id)}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, userName: authUser.name || authUser.email })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
function saveFavoritesState(){
  saveJSON('vs_favorites_v1', favorites);
  setUserState('favorites', favorites).catch(err => console.warn('Favoritos não sincronizados:', err));
}
// V100 — Fila sequencial para escrita de setlists no Appwrite.
// Antes: saveSetlistsState disparava setSharedState fire-and-forget. Se o usuário
// adicionava várias músicas em sequência (mobile, comum), múltiplos PUTs entravam
// em voo simultaneamente. O servidor processa cada PUT como upsert (read-then-write),
// criando race condition que podia fazer um PATCH antigo sobrescrever um PATCH novo.
// Agora: serializamos as escritas com um Promise chain — só uma escrita por vez.
let setlistsSavePromise = Promise.resolve();
let setlistsPendingCount = 0;
// V131.21 — Rastreia IDs de repertórios criados/salvos que ainda não foram
// confirmados na table do Appwrite. Evita que um recarregamento no meio do
// salvamento apague temporariamente um repertório recém-criado.
let pendingNewSetlistIds = new Set();

function flushSetlistsPending(){
  setlistsPendingCount = Math.max(0, setlistsPendingCount - 1);
  if (setlistsPendingCount === 0) {
    saveJSON('vs_setlists_pending_v1', false);
  }
}

function saveSetlistsState(){
  saveJSON('vs_setlists_v1', setlists);
  // V131.18 — Modelo novo: salva cada repertório como documento individual.
  // Assim, salvar NÃO sobrescreve os repertórios de outras pessoas (resolve
  // "cria e some"). Como são poucos repertórios, o custo é baixo.
  // A escrita é serializada para não sobrecarregar, e cada uma é independente.
  setlistsSavePromise = setlistsSavePromise
    .then(async () => {
      for (const s of setlists) {
        await saveSingleSetlist(s);
      }
    })
    .catch(err => console.warn('Repertórios não sincronizados:', err));
  // re-pré-cache e re-render
  try {
    if (typeof precacheSetlistAudios === 'function') precacheSetlistAudios();
    if (libraryLoaded && typeof render === 'function') render();
  } catch (_) {}
}

// ============================================================================
// V131.18 — Persistência por-documento (modelo de dados novo).
// Salva/remove UM repertório de cada vez na collection 'setlists' do Appwrite.
// Cada repertório é um documento independente, então salvar um NÃO sobrescreve
// os outros — resolve "cria e some" e "não aparece pra todo mundo".
// Mantém saveJSON local e o render; a escrita na nuvem é por-documento.
// ============================================================================
async function saveSingleSetlist(setlist){
  if (!setlist || !setlist.id) return;
  saveJSON('vs_setlists_v1', setlists); // mantém cópia local completa
  try {
    if (typeof precacheSetlistAudios === 'function') precacheSetlistAudios();
    if (libraryLoaded && typeof render === 'function') render();
  } catch (_) {}
  if (!authUser) return;
  // V131.21 — Marca como pendente ANTES de enviar, para o auto-refresh não
  // apagar este repertório caso recarregue antes da confirmação do servidor.
  pendingNewSetlistIds.add(setlist.id);
  try {
    const res = await fetch(`/api/appwrite/setlists/${encodeURIComponent(setlist.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: setlist })
    });
    if (!res.ok) throw new Error(await res.text());
    pendingNewSetlistIds.delete(setlist.id); // confirmado na table
  } catch (err) {
    console.warn('Repertório não sincronizado (por-documento):', err.message);
    // Fallback: tenta o método antigo (array inteiro) para não perder o dado
    setSharedState('setlists', setlists).catch(() => {});
  }
}

async function deleteSingleSetlist(setlistId){
  setlists = setlists.filter(s => s.id !== setlistId);
  saveJSON('vs_setlists_v1', setlists);
  pendingNewSetlistIds.delete(setlistId); // V131.21 — não é mais pendente, foi removido
  if (!authUser) return;
  try {
    const res = await fetch(`/api/appwrite/setlists/${encodeURIComponent(setlistId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(await res.text());
  } catch (err) {
    console.warn('Repertório não removido da nuvem:', err.message);
    // Fallback: sincroniza o array (sem o removido) pelo método antigo
    setSharedState('setlists', setlists).catch(() => {});
  }
}

// Carrega repertórios da collection nova. Retorna array ou null se indisponível.
async function loadSetlistsFromCollection(){
  try {
    const res = await fetch('/api/appwrite/setlists');
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.setlists) ? data.setlists : null;
  } catch {
    return null;
  }
}

function saveUsageHistoryState(){
  // V131.8 — Appwrite rejeita valores acima de 50.000 chars. Usamos margem
  // agressiva: 100 eventos base, e poda por tamanho real até ficar abaixo
  // de 40.000 chars (margem ampla de segurança).
  let limited = usageHistory.slice(-100);

  const MAX_CHARS = 40000;
  while (limited.length > 10 && JSON.stringify(limited).length > MAX_CHARS) {
    limited = limited.slice(Math.ceil(limited.length * 0.25)); // remove 25% mais antigos
  }

  usageHistory = limited;
  saveJSON('vs_usage_history_v51', usageHistory);
  // Só sincroniza se couber (checkStateSize evita o erro 400)
  setSharedState('usageHistory', usageHistory).catch(err => console.warn('Histórico não sincronizado:', err.message));
}

function recordUsageEvent(event){
  if (!event || !event.type) return;
  // V131.7 — Guarda só o nome do usuário (string curta), não o objeto completo,
  // para o JSON não estourar o limite de 50.000 chars do Appwrite.
  const userName = authUser ? (authUser.name || authUser.email || '') : '';
  const item = {
    at: new Date().toISOString(),
    u: userName,
    ...event
  };
  usageHistory.push(item);
  saveUsageHistoryState();
  renderHistoryDashboard();
}

function notifySetlistDefined(setlist){
  if (!setlist) return;
  const tracks = mapSetlistTracks(setlist);
  recordUsageEvent({
    type: 'setlist_defined',
    setlistId: setlist.id,
    setlistName: setlist.name,
    trackCount: tracks.length,
    message: `Repertório "${setlist.name}" definido com ${tracks.length} música(s).`
  });
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification('Repertório definido', { body: `O repertório "${setlist.name}" foi atualizado.` });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') new Notification('Repertório definido', { body: `O repertório "${setlist.name}" foi atualizado.` });
      });
    }
  }
  toast('Notificação registrada para a equipe.');
}

function groupCount(items, keyFn){
  const map = new Map();
  items.forEach(item => {
    const key = keyFn(item);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].sort((a,b) => b[1] - a[1]);
}

function renderHistoryDashboard(){
  if (!el.historyTotalPlays) return;
  const plays = usageHistory.filter(e => e.type === 'play');
  const notifications = usageHistory.filter(e => e.type === 'setlist_defined' || e.type === 'setlist_created' || e.type === 'setlist_updated');
  const uniqueTracks = new Set(plays.map(e => e.trackId || e.trackName).filter(Boolean));
  const usedKeys = new Set(plays.map(e => e.changedKey || e.originalKey).filter(Boolean));

  el.historyTotalPlays.textContent = plays.length;
  el.historyUniqueTracks.textContent = uniqueTracks.size;
  el.historyKeysUsed.textContent = usedKeys.size;
  el.historyNotifications.textContent = notifications.length;

  const mostPlayed = groupCount(plays, e => e.trackName).slice(0, 8);
  el.historyMostPlayed.innerHTML = mostPlayed.length ? mostPlayed.map(([name,count]) => `<div class="history-row"><strong>${esc(name)}</strong><span>${count} vez(es)</span></div>`).join('') : '<div class="empty small">Nenhuma reprodução registrada ainda.</div>';

  const keys = groupCount(plays, e => e.changedKey || e.originalKey || 'Sem tom').slice(0, 8);
  el.historyTopKeys.innerHTML = keys.length ? keys.map(([key,count]) => `<div class="history-row"><strong>${esc(key)}</strong><span>${count} uso(s)</span></div>`).join('') : '<div class="empty small">Nenhum tom registrado ainda.</div>';

  const recent = usageHistory.slice(-10).reverse();
  el.historyRecent.innerHTML = recent.length ? recent.map(e => `<div class="history-row"><strong>${esc(historyEventTitle(e))}</strong><span>${esc(formatHistoryDate(e.at))}</span></div>`).join('') : '<div class="empty small">Nenhuma atividade recente.</div>';

  const latestNotifications = notifications.slice(-10).reverse();
  el.historyNotificationsList.innerHTML = latestNotifications.length ? latestNotifications.map(e => `<div class="history-row"><strong>${esc(e.message || historyEventTitle(e))}</strong><span>${esc(formatHistoryDate(e.at))}</span></div>`).join('') : '<div class="empty small">Nenhuma notificação registrada.</div>';
}

function historyEventTitle(e){
  if (e.type === 'play') return `Tocou: ${e.trackName || 'música'}`;
  if (e.type === 'setlist_defined') return `Repertório definido: ${e.setlistName || 'repertório'}`;
  if (e.type === 'setlist_created') return `Repertório criado: ${e.setlistName || 'repertório'}`;
  if (e.type === 'setlist_updated') return `Repertório atualizado: ${e.setlistName || 'repertório'}`;
  return e.type || 'Atividade';
}

function formatHistoryDate(value){
  try {
    return new Date(value).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  } catch {
    return '';
  }
}

function maybeLaunchTour(){
  if (!loadJSON(SESSION_KEY, null)?.name) return;
  if (loadJSON(TOUR_STORAGE_KEY, false) || loadJSON(TOUR_DISABLE_KEY, false)) return;
  setTimeout(startGuidedTour, 900);
}
function startGuidedTour(){
  tourStepIndex = 0;
  if (el.tourStepTotal) el.tourStepTotal.textContent = String(TOUR_STEPS.length);
  if (el.tourDontShowAgain) el.tourDontShowAgain.checked = false;
  if (el.tourProgress) el.tourProgress.innerHTML = TOUR_STEPS.map((_, i) => `<span class=\"tour-dot${i===0 ? ' active' : ''}\"></span>`).join('');
  if (el.tourOverlay) {
    el.tourOverlay.classList.remove('hidden');
    el.tourOverlay.setAttribute('aria-hidden', 'false');
  }
  renderTourStep();
}
function clearTourHighlights(){
  document.querySelectorAll('.tour-highlight').forEach(node => node.classList.remove('tour-highlight'));
}
function renderTourStep(){
  const step = TOUR_STEPS[tourStepIndex];
  if (!step) return finishGuidedTour();

  if (step.hash && location.hash !== step.hash) {
    history.replaceState(null, '', step.hash);
    routeInternalPage();
  } else {
    routeInternalPage();
  }

  if (el.tourTitle) el.tourTitle.textContent = step.title;
  if (el.tourDescription) el.tourDescription.textContent = step.description;
  if (el.tourStepCurrent) el.tourStepCurrent.textContent = String(tourStepIndex + 1);
  if (el.tourPrevBtn) el.tourPrevBtn.disabled = tourStepIndex === 0;
  if (el.tourPrevArrow) el.tourPrevArrow.disabled = tourStepIndex === 0;
  if (el.tourNextBtn) el.tourNextBtn.textContent = tourStepIndex === TOUR_STEPS.length - 1 ? 'Concluir' : 'Próximo';
  if (el.tourNextArrow) el.tourNextArrow.textContent = tourStepIndex === TOUR_STEPS.length - 1 ? '✓' : '→';

  if (el.tourProgress) {
    [...el.tourProgress.children].forEach((dot, idx) => {
      dot.classList.toggle('active', idx === tourStepIndex);
      dot.classList.toggle('done', idx < tourStepIndex);
    });
  }

  setTimeout(() => focusTourTarget(step), 80);
}

function focusTourTarget(step){
  clearTourHighlights();
  const target = document.querySelector(step.selector);
  if (!target) {
    positionTourToTarget(null);
    return;
  }

  target.classList.add('tour-highlight');
  target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

  setTimeout(() => positionTourToTarget(target), 120);
  setTimeout(() => positionTourToTarget(target), 360);
  setTimeout(() => positionTourToTarget(target), 720);
}

function positionTourToTarget(target){
  if (!el.tourCard || !el.tourSpotlight) return;
  const pad = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const defaultRect = { left: vw * 0.5 - 180, top: vh * 0.5 - 70, width: 360, height: 140, bottom: vh * 0.5 + 70, right: vw * 0.5 + 180 };
  const rect = target ? target.getBoundingClientRect() : defaultRect;

  const spotLeft = Math.max(8, rect.left - 10);
  const spotTop = Math.max(8, rect.top - 10);
  const spotWidth = Math.min(vw - 16, rect.width + 20);
  const spotHeight = Math.min(vh - 16, rect.height + 20);
  el.tourSpotlight.style.left = `${spotLeft}px`;
  el.tourSpotlight.style.top = `${spotTop}px`;
  el.tourSpotlight.style.width = `${spotWidth}px`;
  el.tourSpotlight.style.height = `${spotHeight}px`;
  el.tourSpotlight.style.borderRadius = `${Math.max(18, Math.min(28, spotHeight * 0.18))}px`;

  const cardWidth = Math.min(420, vw - 32);
  let left = rect.left;
  let top = rect.bottom + 18;
  const showBelow = rect.top < vh * 0.46;
  if (!showBelow) top = rect.top - 18;
  if (!showBelow) top -= Math.min(240, el.tourCard.offsetHeight || 240);

  if (rect.left + cardWidth > vw - pad) left = vw - cardWidth - pad;
  if (left < pad) left = pad;
  if (top < pad) top = pad;
  const maxTop = vh - (el.tourCard.offsetHeight || 260) - pad;
  if (top > maxTop) top = Math.max(pad, maxTop);

  const alignRight = rect.left > vw * 0.5;
  if (alignRight) left = Math.max(pad, Math.min(left, rect.right - cardWidth));

  el.tourCard.style.left = `${left}px`;
  el.tourCard.style.top = `${top}px`;
}

function changeTourStep(delta){
  const next = tourStepIndex + delta;
  if (next < 0) return;
  if (next >= TOUR_STEPS.length) return finishGuidedTour();
  tourStepIndex = next;
  renderTourStep();
}
function finishGuidedTour(){
  clearTourHighlights();
  if (el.tourOverlay) {
    el.tourOverlay.classList.add('hidden');
    el.tourOverlay.setAttribute('aria-hidden', 'true');
  }
  document.body.style.overflow = '';
  if (el.loginScreen?.classList.contains('hidden')) document.body.classList.remove('app-locked');
  if (el.tourDontShowAgain?.checked) saveJSON(TOUR_DISABLE_KEY, true);
  saveJSON(TOUR_STORAGE_KEY, true);
}

function initSchedule(){
  const localMembers = loadJSON('vs_members_v1', null);
  const localMonths  = loadJSON('vs_schedule_months_v1', null);

  if (Array.isArray(localMembers)) members = normalizeMembers(localMembers);

  // V112 — carrega estrutura multi-mês do storage local; fallback para defaults
  if (localMonths && typeof localMonths === 'object' && !Array.isArray(localMonths)) {
    allScheduleMonths = localMonths;
    // Migra meses do formato antigo (scheduleRows) se necessário
    const legacyRows = loadJSON('vs_schedule_rows_v1', null);
    if (Array.isArray(legacyRows) && legacyRows.length) {
      const monthKey = inferMonthKeyFromRows(legacyRows);
      if (monthKey && !allScheduleMonths[monthKey]) allScheduleMonths[monthKey] = legacyRows;
    }
  } else {
    // Fallback ao formato legado
    const legacyRows = loadJSON('vs_schedule_rows_v1', null);
    allScheduleMonths = { ...DEFAULT_ALL_MONTHS };
    if (Array.isArray(legacyRows) && legacyRows.length) {
      const monthKey = inferMonthKeyFromRows(legacyRows);
      if (monthKey) allScheduleMonths[monthKey] = legacyRows;
    }
  }

  // Garante que os defaults existam
  Object.entries(DEFAULT_ALL_MONTHS).forEach(([k, v]) => {
    if (!allScheduleMonths[k]) allScheduleMonths[k] = v;
  });

  // Define o mês ativo: o mais recente que ainda não passou ou o mais próximo
  activeScheduleMonth = chooseBestMonth();

  // Atualiza scheduleRows para compatibilidade com o código existente
  scheduleRows = allScheduleMonths[activeScheduleMonth] || [];

  populateScheduleFilters();
  renderMonthNav();
  renderSchedule();

  // Bind importação de Excel
  if (el.scheduleImportBtn) {
    el.scheduleImportBtn.addEventListener('click', () => el.scheduleImportInput?.click());
  }
  if (el.scheduleImportInput) {
    el.scheduleImportInput.addEventListener('change', handleScheduleExcelImport);
  }
}

// V112 — Escolhe o mês mais relevante para exibir por padrão
function chooseBestMonth(){
  const keys = Object.keys(allScheduleMonths).sort();
  if (!keys.length) return '';
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  if (keys.includes(currentKey)) return currentKey;
  // Próximo mês futuro
  const future = keys.filter(k => k >= currentKey);
  if (future.length) return future[0];
  // Mais recente passado
  return keys[keys.length - 1];
}

// V112 — Tenta inferir "YYYY-MM" a partir das datas de um array de rows legados
function inferMonthKeyFromRows(rows){
  for (const row of rows) {
    if (!row.date) continue;
    const parts = row.date.split('/');
    if (parts.length >= 2) {
      const day = parts[0], month = parts[1];
      const year = parts[2] || new Date().getFullYear();
      return `${year}-${String(month).padStart(2,'0')}`;
    }
  }
  return null;
}

// V112 — Nome do mês por extenso a partir de "YYYY-MM"
function monthKeyToLabel(key){
  if (!key) return '';
  const [year, month] = key.split('-');
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${months[parseInt(month,10)-1]} ${year}`;
}

// V112 — Renderiza a barra de botões de navegação por mês
function renderMonthNav(){
  if (!el.scheduleMonthNav) return;
  const keys = Object.keys(allScheduleMonths).sort();
  if (keys.length <= 1) {
    el.scheduleMonthNav.style.display = 'none';
    return;
  }
  el.scheduleMonthNav.style.display = '';
  el.scheduleMonthNav.innerHTML = keys.map(key => `
    <button class="month-btn ${key === activeScheduleMonth ? 'active' : ''}" data-month="${esc(key)}">
      ${esc(monthKeyToLabel(key))}
    </button>
  `).join('');
  el.scheduleMonthNav.querySelectorAll('.month-btn').forEach(btn => {
    btn.addEventListener('click', () => switchScheduleMonth(btn.dataset.month));
  });
}

// V112 — Muda para o mês selecionado
function switchScheduleMonth(key){
  if (!allScheduleMonths[key]) return;
  activeScheduleMonth = key;
  scheduleRows = allScheduleMonths[key] || [];
  renderMonthNav();
  populateScheduleFilters();
  renderSchedule();
  // Scroll suave até a seção de escala no mobile
  document.getElementById('escalaMensal')?.scrollIntoView({ behavior:'smooth', block:'start' });
}

// V112 — Salva todos os meses no storage local e na nuvem
async function saveAllScheduleMonths(showToast = false){
  allScheduleMonths[activeScheduleMonth] = scheduleRows;
  saveJSON('vs_schedule_months_v1', allScheduleMonths);
  // Mantém compatibilidade com formato legado
  saveJSON('vs_schedule_rows_v1', scheduleRows);
  if (showToast) toast('Escala salva com sucesso.');
  try {
    await setAdminSharedState('allScheduleMonths', allScheduleMonths);
    await setAdminSharedState('monthlySchedule', scheduleRows);
  } catch(e) {
    console.warn('Escala não sincronizada na nuvem:', e);
  }
}

// V112 — Importação de Excel via SheetJS
// V127.3 — Carrega SheetJS sob demanda (lazy load).
// Era carregado em todas as páginas para todos os usuários (~800 KB),
// mas só é usado pelo admin ao importar escala.
// Agora carrega apenas quando o botão "Importar Excel" é clicado.
let xlsxLoaded = false;
function loadXLSX(){
  return new Promise((resolve, reject) => {
    if (xlsxLoaded || window.XLSX) { xlsxLoaded = true; return resolve(); }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = () => { xlsxLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('Falha ao carregar biblioteca de Excel.'));
    document.head.appendChild(s);
  });
}

async function handleScheduleExcelImport(event){
  const file = event.target.files?.[0];
  if (!file) return;
  if (!isScheduleAdmin()) {
    toast('Somente administradores podem importar escalas.');
    return;
  }
  try {
    // V127.3 — Carrega SheetJS sob demanda se ainda não carregou
    toast('Preparando importação...');
    await loadXLSX();
  } catch(e) {
    toast('Não foi possível carregar a biblioteca de Excel. Verifique sua conexão.');
    return;
  }
  try {
    toast('Lendo arquivo Excel...');
    const buffer = await file.arrayBuffer();
    const wb = window.XLSX.read(buffer, { type:'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = window.XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });

    const rows = parseExcelScheduleRows(raw);
    if (!rows.length) {
      toast('Nenhuma linha de escala encontrada no arquivo. Verifique o formato.');
      return;
    }

    // Detecta o mês do arquivo pelos dados
    const monthKey = inferMonthKeyFromRows(rows) || activeScheduleMonth;
    const label = monthKeyToLabel(monthKey);

    if (!confirm(`Importar ${rows.length} datas para ${label}? Os dados existentes desse mês serão substituídos.`)) return;

    allScheduleMonths[monthKey] = rows;
    activeScheduleMonth = monthKey;
    scheduleRows = rows;

    // Atualiza membros com nomes novos
    const allNames = new Set(members);
    rows.forEach(row => {
      Object.keys(SCHEDULE_ROLE_LABELS).forEach(field => {
        const val = (row[field] || '').trim();
        if (val && val !== '—') allNames.add(val);
      });
    });
    members = [...allNames].sort((a,b) => a.localeCompare(b,'pt-BR'));
    saveJSON('vs_members_v1', members);

    renderMonthNav();
    populateScheduleFilters();
    renderSchedule();
    await saveAllScheduleMonths(true);
    toast(`✓ Escala de ${label} importada com sucesso — ${rows.length} datas.`);
  } catch(e) {
    console.error('[importExcel]', e);
    toast('Erro ao ler o arquivo Excel. Verifique se o formato está correto.');
  } finally {
    if (el.scheduleImportInput) el.scheduleImportInput.value = '';
  }
}

// V112 — Parseia as linhas brutas do Excel para o formato de scheduleRow
function parseExcelScheduleRows(rawRows){
  const DAYS_PT = { 'Quinta':true, 'Domingo':true, 'Segunda':true, 'Terça':true, 'Quarta':true, 'Sexta':true, 'Sábado':true };
  const EXCEL_EPOCH = new Date(1899, 11, 30);

  // Procura o cabeçalho: linha com "Ministro" ou "Minister"
  let headerIdx = -1;
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i].map(c => String(c).toLowerCase());
    if (row.some(c => c.includes('ministro') || c.includes('minister'))) {
      headerIdx = i;
      break;
    }
  }

  const rows = [];
  // Percorre linhas após o cabeçalho (ou da linha 1 se não achou header)
  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 1;

  // V131.16 — Detecta dinamicamente em qual coluna está a DATA, em vez de
  // assumir posição fixa. Alguns Excel têm uma coluna vazia no início, o que
  // deslocava todas as colunas e bagunçava a escala. Procuramos a coluna cujo
  // valor é uma data (serial do Excel ou DD/MM); o dia fica na coluna anterior
  // e as funções (Ministro, Back...) começam na coluna seguinte.
  const isDateValue = (v) => {
    if (typeof v === 'number' && v > 40000) return true;
    return /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(String(v || '').trim());
  };

  for (let i = startIdx; i < rawRows.length; i++) {
    const cells = rawRows[i];
    if (!cells || cells.length < 3) continue;

    // Acha a coluna da data nesta linha (primeira que parece data)
    let dateCol = -1;
    for (let c = 0; c < Math.min(cells.length, 4); c++) {
      if (isDateValue(cells[c])) { dateCol = c; break; }
    }
    if (dateCol < 0) continue; // linha sem data → observação/legenda, ignora

    // Dia da semana: coluna imediatamente antes da data (se houver)
    let day = dateCol > 0 ? String(cells[dateCol - 1] || '').trim() : '';

    // Converte a data
    let dateRaw = cells[dateCol];
    let dateStr = '';
    if (typeof dateRaw === 'number' && dateRaw > 40000) {
      const d = new Date(EXCEL_EPOCH.getTime() + dateRaw * 86400000);
      const dd = String(d.getDate()).padStart(2,'0');
      const mm = String(d.getMonth()+1).padStart(2,'0');
      dateStr = `${dd}/${mm}`;
      if (!day || !DAYS_PT[day]) {
        const diasSemana = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
        day = diasSemana[d.getDay()];
      }
    } else {
      dateStr = String(dateRaw || '').trim();
    }

    // Rejeita dia que seja frase longa (observação)
    if (day && !DAYS_PT[day] && day.length > 12) continue;

    // As funções começam na coluna seguinte à data.
    // Estrutura: Ministro, Back, Back, Back, Baixo, Bateria, Guitarra, Teclado, Violão, Tec. Som
    const f = dateCol + 1;
    const get = (offset) => String(cells[f + offset] || '').trim();
    const minister = get(0), back1 = get(1), back2 = get(2), back3 = get(3),
          bass = get(4), drums = get(5), guitar = get(6), keyboard = get(7),
          acoustic = get(8), sound = get(9);

    // Ignora linha se algum "nome" for uma frase descritiva (observação que vazou)
    const valoresPessoas = [minister, back1, back2, back3, bass, drums, guitar, keyboard, acoustic, sound];
    const temFraseDescritiva = valoresPessoas.some(v =>
      v.length > 30 || /deve ser definido|semana anterior|às \d|horas?|:\d{2}/i.test(v)
    );
    if (temFraseDescritiva) continue;

    rows.push({ day, date:dateStr, minister, back1, back2, back3, bass, drums, guitar, keyboard, acoustic, sound });
  }
  return rows;
}
function populateScheduleFilters(){
  if (!el.scheduleDayFilter) return;
  const currentDay = el.scheduleDayFilter.value;
  const currentMember = el.scheduleMemberFilter?.value || '';
  const days = [...new Set(scheduleRows.map(row => row.day))];
  el.scheduleDayFilter.innerHTML = '<option value="">Todos os dias</option>' + days.map(day => `<option value="${esc(day)}">${esc(day)}</option>`).join('');
  if (el.scheduleMemberFilter) {
    el.scheduleMemberFilter.innerHTML = '<option value="">Todos os membros</option>' + members.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
    if (members.includes(currentMember)) el.scheduleMemberFilter.value = currentMember;
  }
  if (days.includes(currentDay)) el.scheduleDayFilter.value = currentDay;
}
function getFilteredScheduleRows(){
  const q = normalize(el.scheduleSearch?.value || '');
  const day = el.scheduleDayFilter?.value || '';
  const member = el.scheduleMemberFilter?.value || '';
  return scheduleRows.filter(row => {
    if (day && row.day !== day) return false;
    if (member) {
      const values = Object.keys(SCHEDULE_ROLE_LABELS).map(field => row[field] || '');
      if (!values.some(value => normalize(value) === normalize(member))) return false;
    }
    if (!q) return true;
    const blob = normalize(Object.values(row).join(' '));
    return blob.includes(q);
  });
}
function updateScheduleEditUI(){
  const admin = isScheduleAdmin();
  el.scheduleSaveBtn?.classList.toggle('hidden', !admin);
  if (!authUser) setScheduleEditStatus('Faça login para ver a escala completa.', '');
  else if (admin) setScheduleEditStatus(scheduleDirty ? 'Alteração pendente. Clique em “Salvar escala” para confirmar as alterações.' : 'Modo edição ativo. Clique nos nomes para alterar os escalados.', 'admin');
  else if (!cloudAdminConfigured) setScheduleEditStatus('Escala em modo leitura. Somente administradores podem alterar os escalados.', '');
  else setScheduleEditStatus('Escala em modo leitura. Sua conta é de usuário comum e não pode alterar os escalados.', '');
}
function renderSchedule(){
  if (!el.scheduleTableBody) return;
  // V112 — atualiza o título com o mês ativo
  if (el.scheduleTitle) {
    el.scheduleTitle.textContent = activeScheduleMonth
      ? `Escala Louvor Ávida — ${monthKeyToLabel(activeScheduleMonth)}`
      : 'Escala Louvor Ávida';
  }
  // V112 — botão importar visível apenas para admins
  if (el.scheduleImportBtn) el.scheduleImportBtn.classList.toggle('hidden', !isScheduleAdmin());
  updateScheduleEditUI();
  const rows = getFilteredScheduleRows();
  const q = normalize(el.scheduleSearch?.value || '');
  if (!rows.length) {
    el.scheduleTableBody.innerHTML = '<tr><td colspan="11" class="schedule-empty">Nenhum resultado encontrado na escala.</td></tr>';
    if (el.scheduleCards) el.scheduleCards.innerHTML = '<div class="schedule-mobile-empty">Nenhum resultado encontrado na escala.</div>';
  } else {
    el.scheduleTableBody.innerHTML = rows.map(row => renderScheduleRow(row, q)).join('');
    renderScheduleCards(rows, q);
  }
  renderScheduleSummary(rows);
}
function renderScheduleCards(rows, q){
  if (!el.scheduleCards) return;
  const fields = ['minister','back1','back2','back3','bass','drums','guitar','keyboard','acoustic','sound'];
  el.scheduleCards.innerHTML = rows.map(row => {
    const rowIndex = scheduleRows.findIndex(item => item.day === row.day && item.date === row.date);
    const entries = fields.map(field => {
      const content = isScheduleAdmin() && rowIndex >= 0
        ? renderScheduleCell(row, rowIndex, field, q)
        : highlightScheduleMatch(row[field] || '—', q);
      return `<div class="schedule-mobile-item"><span>${esc(SCHEDULE_ROLE_LABELS[field])}</span><div class="schedule-mobile-value">${content}</div></div>`;
    }).join('');
    const nextBadge = isNextSchedule(row) ? '<span class="schedule-mobile-next">Próxima escala</span>' : '';
    return `<article class="schedule-mobile-card ${row.day === 'Quinta' ? 'is-quinta' : 'is-domingo'}">
      <header class="schedule-mobile-head">
        <div class="schedule-mobile-datebox">
          <small>${esc(row.day)}</small>
          <strong>${esc(row.date)}</strong>
        </div>
        ${nextBadge}
      </header>
      <div class="schedule-mobile-grid">${entries}</div>
    </article>`;
  }).join('');
}

function renderScheduleRow(row, q){
  const fields = ['minister','back1','back2','back3','bass','drums','guitar','keyboard','acoustic','sound'];
  const nextClass = isNextSchedule(row) ? ' schedule-row-next' : '';
  const rowIndex = scheduleRows.findIndex(item => item.day === row.day && item.date === row.date);
  return `<tr class="${row.day === 'Quinta' ? 'schedule-row-alt' : ''}${nextClass}" data-row-index="${rowIndex}">
    <td class="schedule-date"><span class="schedule-day-name">${esc(row.day)}</span><strong>${esc(row.date)}</strong></td>
    ${fields.map(field => `<td data-label="${esc(SCHEDULE_ROLE_LABELS[field])}">${renderScheduleCell(row, rowIndex, field, q)}</td>`).join('')}
  </tr>`;
}
function renderScheduleCell(row, rowIndex, field, q){
  const value = row[field] || '';
  if (isScheduleAdmin() && rowIndex >= 0) {
    const options = [''].concat(members).map(name => `<option value="${esc(name)}" ${name === value ? 'selected' : ''}>${esc(name || '—')}</option>`).join('');
    return `<select class="schedule-member-select" data-row-index="${rowIndex}" data-field="${esc(field)}" aria-label="${esc(SCHEDULE_ROLE_LABELS[field])}">${options}</select>`;
  }
  return `<span class="schedule-cell-readonly">${highlightScheduleMatch(value, q)}</span>`;
}
function onScheduleSelectChange(event){
  const select = event.target.closest('.schedule-member-select');
  if (!select) return;
  if (!isScheduleAdmin()) {
    toast('Você não tem permissão para editar a escala.');
    renderSchedule();
    return;
  }
  const rowIndex = Number(select.dataset.rowIndex);
  const field = select.dataset.field;
  if (!Number.isInteger(rowIndex) || !scheduleRows[rowIndex] || !SCHEDULE_ROLE_LABELS[field]) return;
  scheduleRows[rowIndex][field] = select.value;
  select.classList.add('changed', 'schedule-save-pulse');
  scheduleDirty = true;
  saveJSON('vs_schedule_rows_v1', scheduleRows);
  renderScheduleSummary(getFilteredScheduleRows());
  setScheduleEditStatus('Alteração pendente. Clique em “Salvar escala” para confirmar as alterações.', 'admin');
}
function highlightScheduleMatch(value, q){
  const text = esc(value || '');
  if (!q || !value) return text;
  const normalized = normalize(value);
  const idx = normalized.indexOf(q);
  if (idx < 0) return text;
  const before = value.slice(0, idx);
  const match = value.slice(idx, idx + q.length);
  const after = value.slice(idx + q.length);
  return `${esc(before)}<span class="schedule-match">${esc(match)}</span>${esc(after)}`;
}
function renderScheduleSummary(rows){
  if (!el.scheduleSummary) return;
  const people = new Set();
  rows.forEach(row => ['minister','back1','back2','back3','bass','drums','guitar','keyboard','acoustic','sound'].forEach(field => { if (row[field]) people.add(row[field]); }));
  const domingos = rows.filter(row => row.day === 'Domingo').length;
  const quintas = rows.filter(row => row.day === 'Quinta').length;
  el.scheduleSummary.innerHTML = `
    <div class="schedule-pill"><span>Escalas exibidas</span><strong>${rows.length}</strong></div>
    <div class="schedule-pill"><span>Domingos</span><strong>${domingos}</strong></div>
    <div class="schedule-pill"><span>Quintas</span><strong>${quintas}</strong></div>
    <div class="schedule-pill"><span>Pessoas únicas</span><strong>${people.size}</strong></div>
  `;
}
function clearScheduleFilters(){
  if (el.scheduleSearch) el.scheduleSearch.value = '';
  if (el.scheduleDayFilter) el.scheduleDayFilter.value = '';
  if (el.scheduleMemberFilter) el.scheduleMemberFilter.value = '';
  renderSchedule();
}
function isNextSchedule(row){
  const [day, month] = row.date.split('/').map(Number);
  const now = new Date();
  const target = new Date(2026, month - 1, day, 23, 59, 59);
  if (now.getFullYear() !== 2026 || now.getMonth() !== 4) return false;
  const futureRows = scheduleRows.map(r => ({ row: r, date: new Date(2026, Number(r.date.split('/')[1]) - 1, Number(r.date.split('/')[0]), 23, 59, 59) })).filter(item => item.date >= new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  futureRows.sort((a,b) => a.date - b.date);
  return futureRows.length && futureRows[0].row.date === row.date && futureRows[0].row.day === row.day;
}

function useBackend(){ return cfg.USE_BACKEND && location.protocol !== 'file:'; }
function directDriveMedia(id){ return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`; }
function thumbnailUrl(id){ return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w800`; }
function driveUrl(id){ return useBackend() ? `/api/audio/${encodeURIComponent(id)}` : directDriveMedia(id); }
function transposeUrl(id, semitones, appwriteId = '', ready = false){
  if (!semitones) return driveUrl(id);
  const params = new URLSearchParams({ semitones: String(semitones) });
  if (appwriteId) params.set('aw', appwriteId);
  if (ready) params.set('ready', '1');
  return `/api/transpose/${encodeURIComponent(id)}?${params.toString()}`;
}
function transposeStatusUrl(id, semitones, appwriteId = ''){
  const params = new URLSearchParams({ semitones: String(semitones) });
  if (appwriteId) params.set('aw', appwriteId);
  return `/api/transpose-status/${encodeURIComponent(id)}?${params.toString()}`;
}

// V131.19 — Áudio migrado para o Appwrite Storage.
// Se a música (pelo nome do arquivo) está no mapa de migração, geramos a URL
// direta do Appwrite Storage, que é confiável e não depende do Google Drive.
function appwriteAudioUrl(fileId){
  const endpoint = (cfg && cfg.APPWRITE_ENDPOINT) || 'https://nyc.cloud.appwrite.io/v1';
  const project = (cfg && cfg.APPWRITE_PROJECT_ID) || '';
  const bucket = (window.VS_AUDIO_BUCKET_ID) || '6a414dae001076f7ea39';
  return `${endpoint}/storage/buckets/${encodeURIComponent(bucket)}/files/${encodeURIComponent(fileId)}/view?project=${encodeURIComponent(project)}`;
}
// Retorna o ID do Appwrite para uma track, se ela foi migrada (busca pelo fileName)
function appwriteFileIdFor(track){
  if (!track || !window.VS_AUDIO_MAP) return '';
  const fname = track.fileName || '';
  return window.VS_AUDIO_MAP[fname] || '';
}
function downloadUrl(id, name, semitones = 0, appwriteId = ''){
  const filename = encodeURIComponent(`${safeFileName(name)}${semitones ? `_tom_${semitones > 0 ? '+' : ''}${semitones}` : ''}.mp3`);
  if (semitones) {
    const aw = appwriteId ? `&aw=${encodeURIComponent(appwriteId)}` : '';
    return `/api/transpose/${encodeURIComponent(id)}?semitones=${encodeURIComponent(semitones)}${aw}&download=1&filename=${filename}`;
  }
  return useBackend() ? `/api/audio/${encodeURIComponent(id)}?download=1&filename=${filename}` : directDriveMedia(id);
}
function driveViewUrl(id){ return `https://drive.google.com/file/d/${id}/view`; }
function cleanName(name){ return name.replace(/\.[^/.]+$/, '').replace(/[_]+/g,' ').replace(/\s+/g,' ').trim(); }
function getExt(name){ const m = name.toLowerCase().match(/\.([a-z0-9]+)$/); return m ? m[1] : ''; }
function normalize(text){ return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function sortName(a,b){ return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }); }
function safeFileName(name){ return String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w\s.-]/g,'').trim().replace(/\s+/g,'_') || 'audio'; }
function loadJSON(key, fallback){ try { const x = localStorage.getItem(key); return x ? JSON.parse(x) : fallback; } catch { return fallback; } }
function saveJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

function clearDriveLibraryCache(){
  Object.keys(localStorage)
    .filter(key => key.startsWith('vs_drive_cache_'))
    .forEach(key => localStorage.removeItem(key));
}

let hardRefreshInProgress = false;

// V131.31 — Limpeza forte dos caches técnicos sem apagar dados do usuário.
// Preserva sessão, favoritos, repertórios, escala, histórico, tema e preferências.
async function hardResetSystemCache(){
  const result = { server: false, cacheStorage: 0, serviceWorker: false };

  // O endpoint também envia Clear-Site-Data: "cache", limpando o cache HTTP
  // do navegador e invalidando os caches em memória do servidor.
  try {
    const response = await fetch(`/api/cache/hard-reset?t=${Date.now()}`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache',
        'X-VS-Cache-Reset': '1'
      }
    });
    if (!response.ok) throw new Error(`Servidor retornou ${response.status}`);
    result.server = true;
  } catch (error) {
    console.warn('Não foi possível limpar o cache do servidor:', error);
  }

  // Remove todos os caches administrados pelo Service Worker neste domínio,
  // inclusive shell, APIs e áudios offline antigos.
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      const deleted = await Promise.all(keys.map(key => caches.delete(key)));
      result.cacheStorage = deleted.filter(Boolean).length;
    }
  } catch (error) {
    console.warn('Não foi possível limpar o Cache Storage:', error);
  }

  // Solicita uma segunda limpeza ao SW ativo e força a busca da versão atual.
  // Não aguardamos resposta assíncrona para evitar canais de mensagem pendentes.
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_ALL_CACHES' });
      if (registration) await registration.update();
      result.serviceWorker = true;
    }
  } catch (error) {
    console.warn('Não foi possível atualizar o Service Worker:', error);
  }

  clearDriveLibraryCache();
  return result;
}

async function forceRefreshDriveLibrary(){
  if (hardRefreshInProgress) return;
  hardRefreshInProgress = true;

  const refreshButton = el.refresh;
  refreshButton?.classList.add('is-refreshing');
  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.setAttribute('aria-busy', 'true');
    refreshButton.title = 'Limpando cache e atualizando biblioteca...';
  }

  toast('Limpando o cache e atualizando a biblioteca...');

  try {
    const cacheResult = await hardResetSystemCache();

    allTracks = [];
    indexedTrackCount = 0;
    discoveredFolderCount = 0;
    indexedFolderCount = 0;
    libraryLoaded = false;
    libraryLoadStarted = true;
    render();

    await loadLibrary(true);

    if (allTracks.length) {
      const partial = !cacheResult.server;
      toast(partial
        ? 'Biblioteca atualizada e cache local limpo. O cache do servidor não respondeu.'
        : 'Cache limpo e biblioteca atualizada com sucesso.');
    } else {
      toast('Cache limpo. A biblioteca continuará atualizando em segundo plano.');
    }
  } catch (error) {
    console.error('Falha no hard reset da biblioteca:', error);
    toast('O cache foi limpo, mas houve uma falha ao atualizar a biblioteca. Tente novamente.');
  } finally {
    hardRefreshInProgress = false;
    refreshButton?.classList.remove('is-refreshing');
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.removeAttribute('aria-busy');
      refreshButton.title = 'Atualizar biblioteca e limpar cache';
    }
  }
}
function esc(str){ return String(str).replace(/[&<>'"]/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[ch])); }

function normalizeKeyToken(token){
  if (!token) return '';
  let key = String(token).trim().replace('♯','#').replace('♭','b');
  const minor = /m$/i.test(key);
  key = key.replace(/m$/i,'');
  const flatMap = { Db:'C#', Eb:'D#', Gb:'F#', Ab:'G#', Bb:'A#' };
  const proper = key.charAt(0).toUpperCase() + key.slice(1);
  const normalized = flatMap[proper] || proper.toUpperCase();
  return normalized + (minor ? 'm' : '');
}

function formatKeyLabel(key){
  if (!key || key === '—') return '—';
  const normalized = normalizeKeyToken(key);
  const minor = /m$/.test(normalized);
  const base = normalized.replace(/m$/,'');
  const names = {
    'C':'dó',
    'C#':'dó sustenido',
    'D':'ré',
    'D#':'ré sustenido',
    'E':'mi',
    'F':'fá',
    'F#':'fá sustenido',
    'G':'sol',
    'G#':'sol sustenido',
    'A':'lá',
    'A#':'lá sustenido',
    'B':'si'
  };
  const name = names[base] || '';
  if (!name) return normalized;
  return `${normalized} (${name}${minor ? ' menor' : ''})`;
}

// V98 — versão curta para botões compactos do toneModal:
// "C# (dó sustenido)" é longo demais para 3 colunas no celular.
// Aqui retornamos "C# (dó#)" — claro, curto e cabe em 1 linha.
function formatKeyLabelShort(key){
  if (!key || key === '—') return '—';
  const normalized = normalizeKeyToken(key);
  const minor = /m$/.test(normalized);
  const base = normalized.replace(/m$/,'');
  const namesShort = {
    'C':'dó',  'C#':'dó#',
    'D':'ré',  'D#':'ré#',
    'E':'mi',
    'F':'fá',  'F#':'fá#',
    'G':'sol', 'G#':'sol#',
    'A':'lá',  'A#':'lá#',
    'B':'si'
  };
  const name = namesShort[base] || '';
  if (!name) return normalized;
  return `${normalized} (${name}${minor ? 'm' : ''})`;
}

function detectKey(text){
  // V99.1 — Detecção robusta de tom no nome do arquivo.
  // Suporta:
  //   - Notação inglesa: C, D, E, F, G, A, B (com #, b, e m para menor)
  //   - Notação portuguesa: dó, ré, mi, fá, sol, lá, si (com #, sustenido, b, bemol, m, menor)
  //   - Prefixos: "Tom", "Tom de", "Tone", "Key", "em" (apenas quando seguido de tom)
  //   - Formato invertido: Cm# = C#m (correção de digitação comum)
  //   - Espaços múltiplos e (1), (2) parasitas no final
  const rawWithExt = String(text || '');
  let raw = rawWithExt
    .replace(/\.[a-z0-9]+$/i, '')   // tira extensão
    .replace(/[♯]/g, '#')
    .replace(/[♭]/g, 'b')
    .trim();

  // V99.1 — Normalização pré-regex:
  //   1) Remove sufixos parasitas como " (1)", " (2)", " - cópia" no final
  //   2) Corrige formato invertido "Xm#" → "X#m"
  //   3) Colapsa múltiplos espaços em um só
  raw = raw
    .replace(/\s*\(\d+\)\s*$/i, '')           // "(1)" no fim
    .replace(/\s*-\s*c[oó]pia\s*$/i, '')      // " - cópia" no fim
    .replace(/([A-G])m#/g, '$1#m')            // Cm# → C#m  (e Dm#, Em#, etc.)
    .replace(/\s+/g, ' ')                       // espaços múltiplos
    .trim();

  const noAccents = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // --- 1) Notação portuguesa explícita ---
  const PT_NAMES = {
    'do':'C', 're':'D', 'mi':'E', 'fa':'F', 'sol':'G', 'la':'A', 'si':'B'
  };
  const ptRegex = /\b(do|re|mi|fa|sol|la|si)(#|b\b|\s*sustenido|\s*bemol)?(\s*menor|\s*maior|m\b)?/gi;
  const ptMatches = [];
  let ptMatch;
  while ((ptMatch = ptRegex.exec(noAccents)) !== null) {
    const note = PT_NAMES[ptMatch[1].toLowerCase()];
    if (!note) continue;
    let suffix = '';
    if (ptMatch[2]) {
      const mod = ptMatch[2].trim().toLowerCase();
      if (mod === '#' || mod === 'sustenido') suffix = '#';
      else if (mod === 'b' || mod === 'bemol') suffix = 'b';
    }
    const minor = ptMatch[3] && /m|menor/i.test(ptMatch[3]) ? 'm' : '';
    ptMatches.push({ key: note + suffix + minor, index: ptMatch.index, raw: ptMatch[0] });
  }
  const ptValid = ptMatches.filter(m => {
    const before = noAccents.slice(0, m.index).toLowerCase();
    const after = noAccents.slice(m.index + m.raw.length).toLowerCase();
    const followsContext = /(tom\s*(?:de)?|tone|key|em)\s*[:=\-]?\s*$/.test(before);
    const isAtEnd = m.index + m.raw.length >= noAccents.length - 6;
    if (followsContext) return true;
    const lowerRaw = m.raw.toLowerCase().trim();
    if (lowerRaw === 'do' || lowerRaw === 'da') {
      const isolated = /^[\s\)\]\}]*$/.test(after) && /[\s\(\[\{\-]$/.test(before);
      if (!isolated) return false;
    }
    return isAtEnd;
  });
  if (ptValid.length) {
    return normalizeKeyToken(ptValid[ptValid.length - 1].key);
  }

  // --- 2) Notação inglesa com prefixo explícito ---
  const token = '(?:C#|Db|D#|Eb|F#|Gb|G#|Ab|A#|Bb|A|B|C|D|E|F|G)(?:m)?';
  const explicit = new RegExp(
    `\\b(?:tom\\s+de|tom|tone|key)\\s*[:=\\-]?\\s*(${token})(?=$|[\\s_\\-\\.\\)\\]\\}])`,
    'i'
  );
  const explicitMatch = noAccents.match(explicit);
  if (explicitMatch) return normalizeKeyToken(explicitMatch[1]);

  // --- 3) Notação inglesa solta, entre delimitadores ---
  const matches = [];
  // V99.1 — Aceita separador antes (espaço/_/-/(/[/{) e separador depois (idem + fim).
  const re = new RegExp(`(^|[\\s_\\-\\(\\[\\{])(${token})(?=$|[\\s_\\-\\.\\)\\]\\}])`, 'gi');
  let match;
  while ((match = re.exec(noAccents)) !== null) {
    const sep = match[1] || '';
    const key = match[2];
    const index = match.index + sep.length;
    const end = index + key.length;
    const before = noAccents.slice(0, index);
    const after = noAccents.slice(end);

    // a) Filtra "em" como palavra em português
    if (/^em$/i.test(key)) {
      const trimmedAfter = after.trimStart();
      if (/^[a-zA-Z]/.test(trimmedAfter)) continue;
    }

    // V99.1 — b) Filtro de "1 letra solta" reformulado.
    // Aceita tokens de 1 letra (A, B, C, D, E, F, G) quando:
    //   - vem precedido por "-" em qualquer posição (inclusive com espaços), OU
    //   - está entre parênteses/colchetes/chaves, OU
    //   - é o último token do nome (só dígitos/espaços/fim depois)
    if (key.length === 1) {
      // Caractere não-espaço imediatamente antes da posição do token
      const beforeTrim = before.replace(/\s+$/, '');
      const lastCharBefore = beforeTrim.charAt(beforeTrim.length - 1);
      const isAfterHyphen = lastCharBefore === '-';
      const isInBrackets = /[\(\[\{]/.test(lastCharBefore);
      // Caractere não-espaço imediatamente depois
      const afterTrim = after.replace(/^\s+/, '');
      const firstCharAfter = afterTrim.charAt(0);
      const isLastToken = afterTrim === '' || firstCharAfter === '-' || /[\)\]\}\.]/.test(firstCharAfter) || /^\d/.test(afterTrim);
      const startsAtBeginning = index === 0;

      const acceptable = isAfterHyphen || isInBrackets || (isLastToken && !startsAtBeginning);
      if (!acceptable) continue;
    }

    matches.push({ key, index, end });
  }

  if (!matches.length) return '—';

  // Prioriza tons no final, depois mais à direita.
  matches.sort((a, b) => {
    const aAtEnd = a.end >= noAccents.length - 8 ? 0 : 1;
    const bAtEnd = b.end >= noAccents.length - 8 ? 0 : 1;
    if (aAtEnd !== bAtEnd) return aAtEnd - bAtEnd;
    return b.index - a.index;
  });

  return normalizeKeyToken(matches[0].key);
}
function suggestTags(t){
  const text = normalize(`${t.name} ${t.singer} ${t.fileName}`);
  const tags = new Set();
  if (/medley|pot[- ]?pourri/.test(text)) tags.add('Medley');
  if (/instrumental|playback|pb|guia|base/.test(text)) tags.add('Instrumental');
  if (/oracao|oração|secreto|espirito|espírito|presenca|presença|oceans|me atraiu/.test(text)) tags.add('Oração');
  if (/santo|digno|gloria|glória|aleluia|adora|exaltado/.test(text)) tags.add('Adoração');
  if (/celebra|alegr|vitoria|vitória|festa|dan/.test(text)) tags.add('Celebração');
  if (/ceia|mesa|sangue|cruz|calvario|calvário|cordeiro|pao|pão|vinho/.test(text)) tags.add('Ceia');
  if (/jesus|senhor|deus|pai|rei|cristo/.test(text)) tags.add('Congregacional');
  if (/fernanda|gabriela|aline|marine|nivea|nívea|suellem|laura|gabriela/.test(text)) tags.add('Vocal feminino');
  if (/felipe|gabriel|eli|jefferson|fernandinho|samuel|kemuel/.test(text)) tags.add('Vocal masculino');
  if (!tags.size) tags.add('Louvor');
  return [...tags].slice(0,4);
}

async function listChildren(folderId){
  if (useBackend()) {
    const res = await fetch(`/api/drive?folderId=${encodeURIComponent(folderId)}`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }

  let files = [], pageToken = '';
  do {
    const params = new URLSearchParams({
      key: cfg.API_KEY,
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id,name,mimeType,webViewLink)',
      pageSize: '1000',
      orderBy: 'folder,name'
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`${GOOGLE_API}?${params}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao consultar o Google Drive.`);
    const data = await res.json();
    files = files.concat(data.files || []);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return files;
}

async function loadFolder(folderId, singerName = '', inheritedCover = '') {
  const items = await listChildren(folderId);
  const folders = items.filter(i => i.mimeType === 'application/vnd.google-apps.folder').sort(sortName);
  const files = items.filter(i => i.mimeType !== 'application/vnd.google-apps.folder').sort(sortName);
  const localCoverFile = files.find(f => imageExt.includes(getExt(f.name)));
  const cover = localCoverFile ? thumbnailUrl(localCoverFile.id) : inheritedCover;

  let tracks = [];
  for (const file of files) {
    const ext = getExt(file.name);
    if (!audioExt.includes(ext)) continue;
    const singer = singerName || 'Sem pasta';
    const track = {
      id: file.id,
      fileName: file.name,
      ext,
      name: cleanName(file.name),
      singer,
      key: detectKey(file.name),
      tags: [],
      coverUrl: 'assets/logo-avida.jpg',
      webViewLink: file.webViewLink || driveViewUrl(file.id)
    };
    track.tags = suggestTags(track);
    tracks.push(track);
  }

  for (const folder of folders) {
    const nextSinger = singerName || folder.name;
    const childTracks = await loadFolder(folder.id, nextSinger, cover);
    tracks = tracks.concat(childTracks);
  }
  return tracks;
}

function resetProgressCounters(){
  indexedFolderCount = 0;
  discoveredFolderCount = 0;
  indexedTrackCount = 0;
  firstProgressBatchReleased = false;
  updateLoadingProgress('Preparando leitura do Google Drive...');
}

function updateLoadingProgress(stage = ''){
  const folderRatio = discoveredFolderCount ? Math.min(1, indexedFolderCount / discoveredFolderCount) : 0.08;
  const trackBoost = Math.min(0.34, indexedTrackCount / 700);
  const progress = Math.max(8, Math.min(96, Math.round((folderRatio * 62) + (trackBoost * 100))));
  if (el.loadingProgressFill) el.loadingProgressFill.style.width = `${progress}%`;
  if (el.loadingStage && stage) el.loadingStage.textContent = stage;
  if (el.loadingStats) {
    const foldersText = discoveredFolderCount ? `${indexedFolderCount}/${discoveredFolderCount} pastas lidas` : 'Procurando pastas...';
    const tracksText = `${indexedTrackCount} música(s) indexada(s)`;
    el.loadingStats.textContent = `${foldersText} • ${tracksText}`;
  }
}

function completeLoadingProgress(){
  if (el.loadingProgressFill) el.loadingProgressFill.style.width = '100%';
  if (el.loadingStage) el.loadingStage.textContent = 'Biblioteca sincronizada.';
  if (el.loadingStats) el.loadingStats.textContent = `${indexedTrackCount || allTracks.length} música(s) disponíveis.`;
}

function scheduleProgressiveLibraryRender(){
  if (progressiveRenderTimer) return;
  progressiveRenderTimer = setTimeout(() => {
    progressiveRenderTimer = null;
    allTracks.sort((a,b) => a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'}));
    populateFilters();
    updateStats();
    render();
  }, 180);
}

function createTrackFromDriveFile(file, singer, cover){
  const ext = getExt(file.name);
  const track = {
    id: file.id,
    fileName: file.name,
    ext,
    name: cleanName(file.name),
    singer,
    key: detectKey(file.name),
    tags: [],
    coverUrl: 'assets/logo-avida.jpg',
    webViewLink: file.webViewLink || driveViewUrl(file.id)
  };
  track.tags = suggestTags(track);
  return track;
}

async function loadFolderProgressive(folderId, singerName = '', inheritedCover = '', targetTracks = allTracks, live = true){
  discoveredFolderCount += 1;
  updateLoadingProgress(`Lendo ${singerName || 'pasta principal'}...`);

  const items = await listChildren(folderId);
  indexedFolderCount += 1;

  const folders = items.filter(i => i.mimeType === 'application/vnd.google-apps.folder').sort(sortName);
  const files = items.filter(i => i.mimeType !== 'application/vnd.google-apps.folder').sort(sortName);
  const localCoverFile = files.find(f => imageExt.includes(getExt(f.name)));
  const cover = localCoverFile ? thumbnailUrl(localCoverFile.id) : inheritedCover;

  const batch = [];
  for (const file of files) {
    const ext = getExt(file.name);
    if (!audioExt.includes(ext)) continue;
    const singer = singerName || 'Sem pasta';
    batch.push(createTrackFromDriveFile(file, singer, cover));
  }

  if (batch.length) {
    targetTracks.push(...batch);
    indexedTrackCount += batch.length;
    if (live) {
      if (!firstProgressBatchReleased && targetTracks.length >= 12) {
        firstProgressBatchReleased = true;
        hideLoading();
        toast('Músicas aparecerão conforme carregam.');
      }
      scheduleProgressiveLibraryRender();
    }
  }

  updateLoadingProgress(`Indexando ${singerName || 'biblioteca'}...`);

  for (const folder of folders) {
    const nextSinger = singerName || folder.name;
    await loadFolderProgressive(folder.id, nextSinger, cover, targetTracks, live);
  }

  return targetTracks;
}

async function refreshLibraryInBackground(){
  try {
    libraryLoadingInBackground = true;
    resetProgressCounters();

    // V127 — background refresh com timeout de 30s (não trava a UI)
    if (useBackend()) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const resp = await fetch(`/api/library?rootId=${encodeURIComponent(cfg.ROOT_FOLDER_ID)}`, {
          credentials: 'omit', signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data.tracks) && data.tracks.length) {
            const fresh = dedupeTracksById(data.tracks);
            allTracks = fresh;
            saveJSON('vs_drive_cache_v79', { updatedAt: Date.now(), tracks: allTracks });
            afterLibraryLoaded();
            el.status.textContent = 'Biblioteca atualizada.';
            return;
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('Refresh em background falhou:', e);
        return; // Não tenta o fallback progressivo em background — muito pesado
      }
    }

    const freshTracks = [];
    await loadFolderProgressive(cfg.ROOT_FOLDER_ID, '', '', freshTracks, false);
    const deduped = dedupeTracksById(freshTracks);
    deduped.sort((a,b) => a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'}));
    if (deduped.length) {
      allTracks = deduped;
      saveJSON('vs_drive_cache_v79', { updatedAt: Date.now(), tracks: allTracks });
      afterLibraryLoaded();
      el.status.textContent = 'Biblioteca atualizada.';
    }
  } catch (error) {
    console.warn('Atualização em segundo plano falhou:', error);
  } finally {
    libraryLoadingInBackground = false;
  }
}

async function loadLibrary(force = false){
  try {
    showLoading(force ? 'Atualizando biblioteca de músicas...' : 'Preparando biblioteca...');
    resetProgressCounters();
    el.status.textContent = 'Preparando biblioteca...';

    const cacheKey = 'vs_drive_cache_v79';
    if (!force) {
      const cached = loadJSON(cacheKey, null);
      if (cached && Array.isArray(cached.tracks) && cached.tracks.length) {
        // V99 — reaplica detectKey sobre o cache antigo. Versões anteriores tinham
        // detecção mais fraca, então músicas que estavam com key="" ou "—" podem
        // ter o tom recuperado direto do nome do arquivo. Não toca em tons já bons.
        allTracks = dedupeTracksById(cached.tracks).map(t => {
          if (!t.key || t.key === '—' || t.key === '') {
            const recovered = detectKey(`${t.name || ''} ${t.fileName || ''}`);
            if (recovered && recovered !== '—') return { ...t, key: recovered };
          }
          return t;
        });
        afterLibraryLoaded();
        el.status.textContent = 'Biblioteca pronta.';
        hideLoading();
        precacheSetlistAudios();
        refreshLibraryInBackground();
        return;
      }
    }

    // V127 — Tenta o endpoint consolidado /api/library com timeout.
    // Se o Render está dormindo, o fetch trava por 60s+. Com timeout de 8s,
    // mostramos uma mensagem amigável e continuamos tentando em background.
    if (useBackend()) {
      try {
        const url = `/api/library?rootId=${encodeURIComponent(cfg.ROOT_FOLDER_ID)}${force ? `&force=1&t=${Date.now()}` : ''}`;

        // Timeout de 8s: se o servidor não responde, avisa o usuário
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          // Mostra mensagem amigável em vez de loading genérico
          if (el.loadingMessage) {
            el.loadingMessage.innerHTML =
              '⏳ O servidor está acordando...<br>' +
              '<small style="opacity:.6">Isso pode levar até 1 minuto na primeira abertura do dia.<br>Você pode usar o app normalmente enquanto espera.</small>';
          }
          el.status.textContent = 'Aguardando servidor...';
        }, 8000);

        const resp = await fetch(url, { credentials: 'omit', signal: controller.signal, cache: force ? 'no-store' : 'default' });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data.tracks) && data.tracks.length) {
            allTracks = dedupeTracksById(data.tracks);
            saveJSON(cacheKey, { updatedAt: Date.now(), tracks: allTracks });
            afterLibraryLoaded();
            completeLoadingProgress();
            el.status.textContent = `Biblioteca pronta — ${data.count} músicas.`;
            hideLoading();
            precacheSetlistAudios();
            return;
          }
        }
        console.warn('/api/library indisponível ou vazio, usando indexação progressiva.');
      } catch (e) {
        if (e.name === 'AbortError') {
          // Timeout atingido — tenta novamente em background sem travar a UI
          console.warn('Servidor demorou a responder, tentando em background...');
          setTimeout(() => refreshLibraryInBackground(), 2000);
          hideLoading();
          return;
        }
        console.warn('Falha ao usar /api/library, fallback para indexação progressiva:', e);
      }
    }

    allTracks = [];
    afterLibraryLoaded();
    el.status.textContent = 'Carregando músicas...';

    setTimeout(() => {
      if (!firstProgressBatchReleased) {
        hideLoading();
        toast('Músicas aparecerão conforme carregam.');
      }
    }, 1400);

    await loadFolderProgressive(cfg.ROOT_FOLDER_ID, '', '', allTracks, true);
    allTracks = dedupeTracksById(allTracks);
    allTracks.sort((a,b) => a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'}));
    saveJSON(cacheKey, { updatedAt: Date.now(), tracks: allTracks });
    afterLibraryLoaded();
    completeLoadingProgress();
    el.status.textContent = 'Biblioteca carregada';
    hideLoading();
    precacheSetlistAudios();
  } catch (error) {
    console.error(error);
    hideLoading();
    el.status.textContent = 'Erro ao carregar a biblioteca';
    el.trackList.innerHTML = `<div class="empty">${esc(error.message || 'Erro ao carregar')}</div>`;
  }
}

// V94 — Remove músicas duplicadas pelo mesmo id do Drive (mantém a 1ª ocorrência).
function dedupeTracksById(tracks){
  if (!Array.isArray(tracks)) return [];
  // V99 — Dupla desduplicação:
  //   1) Por id do Drive (mesmo arquivo aparecendo 2x na indexação).
  //   2) Por nome normalizado de arquivo: se a MESMA música foi colocada em
  //      duas pastas diferentes (ids diferentes), preferimos a primeira.
  const seenIds = new Set();
  const seenNames = new Set();
  const out = [];
  let dupedByName = 0;
  for (const t of tracks) {
    if (!t || !t.id) continue;
    if (seenIds.has(t.id)) continue;
    const normalizedFileName = String(t.fileName || t.name || '')
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, '')   // tira extensão
      .replace(/[\s_\-]+/g, ' ')       // normaliza separadores
      .replace(/\s+/g, ' ')
      .trim();
    if (normalizedFileName && seenNames.has(normalizedFileName)) {
      dupedByName++;
      continue;
    }
    seenIds.add(t.id);
    if (normalizedFileName) seenNames.add(normalizedFileName);
    out.push(t);
  }
  if (dupedByName > 0 && typeof console !== 'undefined') {
    console.info(`[dedupe] ${dupedByName} duplicata(s) por nome de arquivo removida(s).`);
  }
  return out;
}

// V94 — Conjunto de ids de música que estão em ALGUM repertório (priorização).
function getSetlistTrackIdSet(){
  const ids = new Set();
  for (const s of (setlists || [])) {
    for (const entry of (s.trackIds || [])) {
      const id = getSetlistEntryTrackId(entry);
      if (id) ids.add(id);
    }
  }
  return ids;
}

// V94 — Pede ao Service Worker para baixar e cachear os áudios das músicas
// que estão em repertórios. Roda em segundo plano, em pequenas levas, sem travar o app.
let precachingInFlight = false;
async function precacheSetlistAudios(){
  if (precachingInFlight) return;
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
  const sw = reg && (reg.active || reg.waiting);
  if (!sw) return;

  const ids = getSetlistTrackIdSet();
  if (!ids.size) return;

  // Só pré-baixa se estiver em wifi/rede boa. Em conexão lenta, deixa sob demanda.
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && (conn.saveData || /2g/i.test(conn.effectiveType || ''))) return;

  precachingInFlight = true;
  try {
    const urls = [];
    for (const t of allTracks) {
      if (ids.has(t.id)) urls.push(driveUrl(t.id));
      if (urls.length >= 60) break; // segurança: no máx 60 por sessão
    }
    if (urls.length) sw.postMessage({ type: 'PRECACHE_AUDIOS', urls });
  } catch (_) {
    // silencioso
  } finally {
    setTimeout(() => { precachingInFlight = false; }, 30000);
  }
}

function afterLibraryLoaded(){
  libraryLoaded = true;
  populateFilters();
  // V131.5 — Remove IDs órfãos dos repertórios agora que a biblioteca
  // está carregada e sabemos quais músicas realmente existem.
  cleanOrphanSetlistTracks();
  updateStats();
  renderSetlists();
  render();
}

function populateFilters(){
  const musicNames = unique(allTracks.map(t => t.name)).sort(localeSort);
  const keys = unique(allTracks.map(t => t.key).filter(Boolean)).sort(localeSort);
  const tags = unique(allTracks.flatMap(t => t.tags || [])).sort(localeSort);
  const types = unique(allTracks.map(t => t.ext.toUpperCase())).sort(localeSort);

  fillSelect(el.musicFilter, 'Todas as músicas', musicNames);
  fillSelect(el.keyFilter, 'Todos os tons', keys);
  fillSelect(el.tagFilter, 'Todas as tags', tags);
  fillSelect(el.typeFilter, 'Todos os arquivos', types);
}
function fillSelect(select, placeholder, values){
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>` + values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  if (values.includes(current)) select.value = current;
}
function unique(arr){ return [...new Set(arr.filter(Boolean))]; }
function localeSort(a,b){ return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' }); }

function updateStats(){
  const folders = unique(allTracks.map(t => t.singer));

  // V121 — Conta apenas repertórios NÃO arquivados (ativos/próximos)
  const activeSetlists = setlists.filter(s => !isSetlistAutoArchived(s));

  // Próximo culto: repertório ativo com eventDate mais próxima do futuro
  const today = new Date(); today.setHours(0,0,0,0);
  const withDate = activeSetlists
    .filter(s => s.eventDate)
    .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
  const nextCulto = withDate.length
    ? withDate[0]
    : (activeSetlists.length ? activeSetlists[activeSetlists.length - 1] : null);

  // Stats da biblioteca
  el.totalTracks.textContent = allTracks.length;
  el.totalSingers.textContent = folders.length;
  el.totalSingersInline.textContent = folders.length;

  // Stats do hero
  el.heroTotal.textContent = allTracks.length;
  el.heroTotalPanel.textContent = allTracks.length;
  if (el.heroSingers) el.heroSingers.textContent = folders.length;
  if (el.heroSetlists) el.heroSetlists.textContent = activeSetlists.length;

  // Painel lateral
  if (el.totalActiveSetlists)  el.totalActiveSetlists.textContent = activeSetlists.length;
  if (el.totalActiveSetlists2) el.totalActiveSetlists2.textContent = activeSetlists.length;

  // Card "Próximo culto"
  if (el.nextCultoName && el.nextCultoDate) {
    if (nextCulto) {
      // Nome curto: máx 14 chars para caber no card
      const shortName = nextCulto.name.length > 14
        ? nextCulto.name.slice(0, 13) + '…'
        : nextCulto.name;
      el.nextCultoName.textContent = shortName;
      el.nextCultoDate.textContent = nextCulto.eventDate
        ? new Date(nextCulto.eventDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' })
        : `${countValidSetlistTracks(nextCulto)} músicas`;
    } else {
      el.nextCultoName.textContent = '—';
      el.nextCultoDate.textContent = 'Nenhum ativo';
    }
  }

  // Click no card leva para a guia de repertórios
  if (el.nextCultoStat && !el.nextCultoStat.dataset.bound) {
    el.nextCultoStat.dataset.bound = '1';
    el.nextCultoStat.addEventListener('click', () => {
      location.hash = '#repertorios';
    });
  }

  updateProfileModal();
  renderHistoryDashboard();
}

function clearFilters(){
  el.search.value = '';
  el.musicFilter.value = '';
  el.keyFilter.value = '';
  el.tagFilter.value = '';
  el.typeFilter.value = '';
  isFavoritesFilter = false;
  el.favoritesOnly.classList.remove('favorites-active');
  render();
}

function getFiltered(){
  const q = normalize(el.search.value);
  const result = allTracks.filter(t => {
    if (isFavoritesFilter && !favorites.includes(t.id)) return false;
    if (el.musicFilter.value && t.name !== el.musicFilter.value) return false;
    if (el.keyFilter.value && t.key !== el.keyFilter.value) return false;
    if (el.tagFilter.value && !(t.tags || []).includes(el.tagFilter.value)) return false;
    if (el.typeFilter.value && t.ext.toUpperCase() !== el.typeFilter.value) return false;
    if (!q) return true;
    const blob = normalize(`${t.name} ${t.singer} ${t.fileName} ${(t.tags||[]).join(' ')} ${t.key}`);
    return blob.includes(q);
  });

  // V94 — Quando não há busca textual ativa, priorizar músicas dos repertórios
  // (carregam primeiro na biblioteca, já cacheadas pelo SW = abertura instantânea).
  if (!q) {
    const setlistIds = getSetlistTrackIdSet();
    if (setlistIds.size) {
      result.sort((a, b) => {
        const aIn = setlistIds.has(a.id) ? 0 : 1;
        const bIn = setlistIds.has(b.id) ? 0 : 1;
        if (aIn !== bIn) return aIn - bIn;
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      });
    }
  }
  return result;
}

function isMobileMusicView(){
  return window.matchMedia('(max-width: 760px)').matches;
}

function getEffectiveViewMode(){
  return isMobileMusicView() ? 'details' : viewMode;
}

function setViewMode(mode){
  if (!['thumbnails', 'details'].includes(mode)) return;
  viewMode = isMobileMusicView() ? 'details' : mode;
  saveJSON('vs_view_mode_v10', viewMode);
  applyViewMode();
  render();
}

function applyViewMode(){
  const effectiveMode = getEffectiveViewMode();
  el.viewThumbBtn.classList.toggle('is-active', effectiveMode === 'thumbnails');
  el.viewDetailBtn.classList.toggle('is-active', effectiveMode === 'details');
  el.trackList.classList.toggle('view-thumbnails', effectiveMode === 'thumbnails');
  el.trackList.classList.toggle('view-details', effectiveMode === 'details');
  el.viewThumbBtn.disabled = isMobileMusicView();
}

function setupInfiniteScroll(){
  if (infiniteObserver) infiniteObserver.disconnect();

  infiniteObserver = new IntersectionObserver(entries => {
    const entry = entries[0];
    if (entry && entry.isIntersecting) loadMoreTracks();
  }, {
    root: null,
    rootMargin: '420px',
    threshold: 0.01
  });

  if (el.loadSentinel) infiniteObserver.observe(el.loadSentinel);
}

function render(){
  applyViewMode();
  renderActiveSetlistBanner();
  renderPaletteSelectionTarget();

  filteredTracksCache = getFiltered();
  renderedCount = 0;

  el.resultCount.textContent = `${filteredTracksCache.length} resultado(s)`;

  if (!filteredTracksCache.length) {
    const loadingMsg = indexedTrackCount === 0 && (libraryLoadingInBackground || discoveredFolderCount > indexedFolderCount)
      ? 'A biblioteca ainda está sendo indexada. As músicas aparecerão automaticamente conforme forem encontradas.'
      : 'Nenhuma música encontrada com os filtros atuais.';
    el.trackList.innerHTML = `<div class="empty">${loadingMsg}</div>`;
    el.loadStatus.textContent = indexedTrackCount === 0 ? 'Carregando músicas...' : 'Nenhuma música para carregar';
    return;
  }

  el.trackList.innerHTML = '';
  loadMoreTracks(PAGE_SIZE[getEffectiveViewMode()], true);
  setupInfiniteScroll();
}

function loadMoreTracks(amount = LOAD_MORE_SIZE[getEffectiveViewMode()], initial = false){
  if (!filteredTracksCache.length) return;

  const nextItems = filteredTracksCache.slice(renderedCount, renderedCount + amount);
  if (!nextItems.length) {
    el.loadStatus.textContent = `Todas as ${filteredTracksCache.length} músicas foram carregadas`;
    return;
  }

  el.trackList.insertAdjacentHTML('beforeend', nextItems.map((t) => renderTrackCard(t)).join(''));
  bindTrackCardEvents(el.trackList);
  renderedCount += nextItems.length;

  if (renderedCount >= filteredTracksCache.length) {
    el.loadStatus.textContent = `Todas as ${filteredTracksCache.length} músicas foram carregadas`;
  } else {
    const remaining = filteredTracksCache.length - renderedCount;
    const modeLabel = getEffectiveViewMode() === 'thumbnails' ? 'miniaturas' : 'detalhes';
    el.loadStatus.textContent = `${renderedCount} de ${filteredTracksCache.length} carregadas • ${remaining} restantes • modo ${modeLabel}`;
  }
}

function renderTrackCard(t){
  const fav = favorites.includes(t.id);
  const coverStyle = `style="background-image:url('${esc(t.coverUrl || 'assets/logo-avida.jpg')}')"`;
  const activeSetlist = getActiveEditableSetlist();
  const isInActiveSetlist = activeSetlist ? isTrackPresentInSetlist(activeSetlist, t.id) : false;
  const setlistTitle = activeSetlist ? `Adicionar a este repertório: ${activeSetlist.name}` : 'Adicionar ao repertório';
  const setlistLabel = activeSetlist ? 'Adicionar a este repertório' : 'Adicionar ao repertório';
  return `
    <article class="track-card ${isInActiveSetlist ? 'track-in-active-setlist' : ''}" data-id="${esc(t.id)}">
      <div class="track-head">
        <div class="track-cover logo-cover" ${coverStyle}></div>
        <div class="track-main">
          <div class="track-title">${esc(t.name)}</div>
          <div class="track-sub">${esc(t.singer)}</div>
        </div>
      </div>
      <div class="track-meta">
        <span class="meta key">Tom ${esc(formatKeyLabel(t.key || '—'))}</span>
        <span class="meta">${esc(t.ext.toUpperCase())}</span>
        ${isInActiveSetlist ? `<span class="meta in-setlist">No repertório ativo</span>` : ''}
      </div>
      <div class="tag-wrap">${(t.tags || []).map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</div>
      <div class="track-actions ${activeSetlist ? 'has-active-setlist' : ''}">
        <button class="action-btn primary play-btn" data-id="${esc(t.id)}" aria-label="Tocar" title="Tocar"></button>
        <button class="action-icon tone-btn-open" data-id="${esc(t.id)}" title="Alterar tom" aria-label="Alterar tom">♬</button>
        <button class="action-icon fav-btn ${fav ? 'is-fav' : ''}" data-id="${esc(t.id)}" title="Favoritar" aria-label="Favoritar">${fav ? '♥' : '♡'}</button>
        <button class="action-icon setlist-btn ${activeSetlist ? 'is-active-target' : ''} ${isInActiveSetlist ? 'is-already-added' : ''}" data-id="${esc(t.id)}" title="${esc(setlistTitle)}" data-tooltip="${esc(setlistLabel)}" aria-label="${esc(setlistTitle)}"><span class="action-icon-glyph">${isInActiveSetlist ? '✓' : '+'}</span><span class="action-icon-label"></span></button>
        <button class="action-icon detail-btn" data-id="${esc(t.id)}" title="Ver detalhes" aria-label="Ver detalhes">⋯</button>
      </div>
    </article>
  `;
}

function bindTrackCardEvents(container){
  container.querySelectorAll('.play-btn:not([data-bound])').forEach(btn => {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => playTrack(findTrack(btn.dataset.id), 0, filteredTracksCache));
  });

  container.querySelectorAll('.fav-btn:not([data-bound])').forEach(btn => {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => toggleFavorite(btn.dataset.id));
  });

  container.querySelectorAll('.tone-btn-open:not([data-bound])').forEach(btn => {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => openToneModal(findTrack(btn.dataset.id)));
  });

  container.querySelectorAll('.setlist-btn:not([data-bound])').forEach(btn => {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const track = findTrack(btn.dataset.id);
      const active = getActiveEditableSetlist();
      if (active && track) {
        addTrackToSetlist(active, track, { semitones: 0, tone: '' }, { toastMessage: `Música adicionada ao repertório ativo: ${active.name}.` });
        return;
      }
      openSetlistModal(track);
    });
  });

  container.querySelectorAll('.detail-btn:not([data-bound])').forEach(btn => {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => openSongModal(findTrack(btn.dataset.id)));
  });
}

function handleAudioEnded(){
  setPlayButtonState(false);
  if (!randomContinuousMode) return;

  const queue = currentQueue.length ? currentQueue : getFiltered();
  if (!queue.length) return;

  let nextIndex = Math.floor(Math.random() * queue.length);
  if (queue.length > 1 && nextIndex === currentIndex) {
    nextIndex = (nextIndex + 1) % queue.length;
  }

  currentIndex = nextIndex;
  playTrack(queue[nextIndex], null, queue, { randomContinuous: true });
}

function findTrack(id){ return allTracks.find(t => t.id === id); }


function prewarmTrackAudio(track, semitones = null){
  if (!track || current?.id === track.id) return;
  const sourceSemitones = semitones !== null && semitones !== undefined ? semitones : Number(track.repertoireSemitones || 0);
  const source = sourceSemitones ? transposeUrl(track.id, Number(sourceSemitones || 0)) : driveUrl(track.id);
  // Não troca o player principal; apenas pede ao navegador para começar a resolver/conectar ao arquivo.
  try {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = 'https://drive.google.com';
    document.head.appendChild(link);
    setTimeout(() => link.remove(), 4000);
  } catch(_) {}
}

function playTrack(track, semitones = null, queue = currentQueue, options = {}){
  if (!track) return;
  randomContinuousMode = Boolean(options.randomContinuous);
  document.body.classList.add('player-visible');
  document.getElementById('playerArea')?.classList.remove('player-hidden');
  if (semitones === null || semitones === undefined) semitones = Number(track.repertoireSemitones || 0);
  current = track;
  currentQueue = queue && queue.length ? queue : getFiltered();
  currentIndex = currentQueue.findIndex(t => t.id === track.id);
  const alteredToneLabel = track.repertoireTone || (semitones ? calculateToneLabel(track.key, semitones) : '');

  el.nowTitle.textContent = alteredToneLabel ? `${track.name} • Tom alterado ${formatKeyLabel(alteredToneLabel)}` : track.name;
  el.nowSinger.textContent = `${track.singer}${track.key && track.key !== '—' ? ' • Tom original ' + formatKeyLabel(track.key) : ''}${alteredToneLabel ? ' • Tom alterado ' + formatKeyLabel(alteredToneLabel) : ''}`;
  el.nowCover.src = track.coverUrl || 'assets/logo-avida.jpg';
  setPlayButtonState(true);

  // V131.3 — Fallback em cascata. A URL direta do Google Drive é tentada
  // PRIMEIRO porque o browser do usuário acessa o Drive de forma confiável,
  // enquanto o proxy do servidor (/api/audio) falha intermitentemente.
  // Ordem: 1) API direta do Drive  2) download direto  3) proxy do servidor
  // Para tom alterado (transpose), só o servidor faz — então usa só ele.
  // V131.10 — O diagnóstico confirmou que o proxy do servidor (/api/audio)
  // baixa o áudio corretamente (status 206). As URLs diretas do Google Drive
  // falham no navegador por CORS. Então usamos o proxy do servidor PRIMEIRO,
  // e as URLs diretas apenas como reserva caso o servidor fique indisponível.
  // V131.19 — Se a música foi migrada para o Appwrite Storage, ela é a fonte
  // PRIMÁRIA (confiável, sem depender do Google Drive). O Drive fica como
  // fallback para músicas ainda não migradas.
  const appwriteId = appwriteFileIdFor(track);
  let candidates;
  if (semitones) {
    // V131.30 — usa Appwrite como fonte quando a música já foi migrada.
    // Na primeira execução o servidor toca progressivamente enquanto gera o cache.
    candidates = [transposeUrl(track.id, semitones, appwriteId)];
  } else if (appwriteId) {
    // V131.25 — Música migrada: usa o PROXY do servidor (/api/aw-audio), que
    // encaminha Range e propaga Content-Length — o navegador calcula a duração
    // e o cursor de tempo (seek) funciona. A URL direta /view do Appwrite não
    // enviava esses headers, travando o seek e causando delay. A direta fica
    // como reserva, e o Drive como última opção.
    candidates = [
      `/api/aw-audio/${encodeURIComponent(appwriteId)}`,
      appwriteAudioUrl(appwriteId),
      `/api/audio/${encodeURIComponent(track.id)}`
    ];
  } else {
    // Não migrada: fluxo antigo do Drive
    candidates = [
      `/api/audio/${encodeURIComponent(track.id)}`,
      driveDirectApiUrl(track.id),
      driveDirectDownloadUrl(track.id)
    ];
  }

  el.audio._candidates = candidates;
  el.audio._candidateIndex = 0;
  el.audio._trackId = track.id;
  el.audio._transposeSemitones = Number(semitones || 0);
  el.audio._transposeAppwriteId = appwriteId || '';
  el.audio._transposePromoted = false;
  el.audio._transposePromotionInProgress = false;
  el.audio._transposeSeekableReady = !semitones;
  el.audio._transposePendingSeekPct = null;
  el.audio._transposeSeekToastShown = false;
  clearTransposeReadyWatch();

  loadAudioCandidate(0);
  if (semitones) watchTransposeReady(track, semitones, appwriteId);

  recordUsageEvent({ type: 'play', trackId: track.id, trackName: track.name, singer: track.singer, originalKey: formatKeyLabel(track.key), changedKey: alteredToneLabel || '', semitones });
  syncProgressUI();
}

// V131 — Carrega uma URL candidata; se falhar, o handler de erro tenta a próxima
function loadAudioCandidate(index){
  const candidates = el.audio._candidates || [];
  if (index >= candidates.length) {
    console.error('[audio] todas as fontes falharam para', el.audio._trackId);
    setPlayButtonState(false);
    toast('Não foi possível reproduzir esta música. Verifique sua conexão.');
    return;
  }
  el.audio._candidateIndex = index;
  const src = candidates[index];
  el.audio.preload = 'auto';
  el.audio.src = src;
  try { el.audio.load(); } catch(_) {}

  const p = el.audio.play();
  if (p && typeof p.catch === 'function') {
    p.catch(err => {
      if (err.name === 'AbortError') return; // troca de faixa, ignorar
      console.warn(`[audio] fonte ${index} falhou (${err.name}), tentando próxima...`);
      // Tenta a próxima fonte
      loadAudioCandidate(index + 1);
    });
  }
}

// V131.32 — A primeira transposição é enviada progressivamente para começar a
// tocar rápido. Assim que o arquivo completo fica pronto, o player SEMPRE troca
// para uma URL seekable com Content-Length/Range. A versão anterior tentava
// detectar se o stream já era seekable pelo objeto HTMLAudioElement; no Chrome
// essa detecção podia dar falso positivo e impedir a troca até recarregar a página.
function clearTransposeReadyWatch(){
  if (!el.audio) return;
  if (el.audio._transposeReadyTimer) clearTimeout(el.audio._transposeReadyTimer);
  el.audio._transposeReadyTimer = null;
  el.audio._transposeReadyToken = '';
}

function watchTransposeReady(track, semitones, appwriteId = '', immediate = false){
  clearTransposeReadyWatch();
  const token = `${track.id}:${Number(semitones)}:${appwriteId || ''}:${Date.now()}`;
  el.audio._transposeReadyToken = token;
  let attempts = 0;

  const poll = async () => {
    if (el.audio._transposeReadyToken !== token) return;
    if (!current || current.id !== track.id || Number(el.audio._transposeSemitones || 0) !== Number(semitones)) {
      clearTransposeReadyWatch();
      return;
    }

    attempts += 1;
    try {
      const response = await fetch(transposeStatusUrl(track.id, semitones, appwriteId), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (response.ok) {
        const status = await response.json();
        if (status.ready) {
          clearTransposeReadyWatch();
          promoteTransposeToSeekable(track, semitones, appwriteId, status.version || '');
          return;
        }
      }
    } catch (_) {}

    if (attempts < 600 && el.audio._transposeReadyToken === token) {
      // Consulta mais rápida enquanto existe um clique de seek aguardando.
      const delay = Number.isFinite(el.audio._transposePendingSeekPct) ? 350 : 800;
      el.audio._transposeReadyTimer = setTimeout(poll, delay);
    } else {
      clearTransposeReadyWatch();
    }
  };

  el.audio._transposeReadyTimer = setTimeout(poll, immediate ? 0 : 350);
}

function applyTransposeResumePosition(audio, targetResolver, shouldResume, expectedReadyUrl){
  let applied = false;
  let retries = 0;

  const apply = () => {
    if (applied) return true;
    const activeSource = String(audio.currentSrc || audio.src || '');
    if (expectedReadyUrl && !activeSource.includes(expectedReadyUrl)) return false;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (!duration) return false;

    const requested = Number(targetResolver(duration));
    const target = Number.isFinite(requested)
      ? Math.min(Math.max(0, requested), Math.max(0, duration - 0.1))
      : 0;

    try {
      audio.currentTime = target;
      applied = true;
      audio._transposeSeekableReady = true;
      audio._transposePromotionInProgress = false;
      audio._transposePendingSeekPct = null;
      audio._transposeSeekToastShown = false;
      syncProgressUI();

      if (shouldResume) {
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
      }
      return true;
    } catch (_) {
      return false;
    }
  };

  const retry = () => {
    if (apply() || retries >= 20) return;
    retries += 1;
    setTimeout(retry, 100);
  };

  audio.addEventListener('loadedmetadata', retry, { once: true });
  audio.addEventListener('durationchange', retry, { once: true });
  audio.addEventListener('canplay', retry, { once: true });
  retry();
}

function promoteTransposeToSeekable(track, semitones, appwriteId = '', cacheVersion = ''){
  const audio = el.audio;
  if (!audio || audio._transposePromotionInProgress || audio._transposeSeekableReady) return;
  if (!current || current.id !== track.id || Number(audio._transposeSemitones || 0) !== Number(semitones)) return;

  audio._transposePromotionInProgress = true;
  audio._transposePromoted = true;

  const resumeAt = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  const shouldResume = !audio.paused;

  const params = new URLSearchParams({
    semitones: String(semitones),
    ready: '1',
    cv: cacheVersion || String(Date.now())
  });
  if (appwriteId) params.set('aw', appwriteId);
  const readyUrl = `/api/transpose/${encodeURIComponent(track.id)}?${params.toString()}`;

  audio._candidates = [readyUrl];
  audio._candidateIndex = 0;

  const readyUrlMarker = `cv=${encodeURIComponent(params.get('cv') || '')}`;
  applyTransposeResumePosition(
    audio,
    (duration) => Number.isFinite(audio._transposePendingSeekPct)
      ? (Number(audio._transposePendingSeekPct) / 100) * duration
      : resumeAt,
    shouldResume,
    readyUrlMarker
  );

  audio.preload = 'auto';
  audio.src = readyUrl;
  try { audio.load(); } catch (_) {}
}

// Quando o usuário tenta mover o cursor antes do arquivo final ficar pronto,
// guardamos a posição escolhida e aplicamos automaticamente ao terminar.
// Não é possível fazer seek real no stream progressivo porque ele ainda está
// sendo criado; esta fila evita exigir recarregamento da página.
function queueTransposeSeek(pct){
  const audio = el.audio;
  if (!audio || !Number(audio._transposeSemitones || 0) || audio._transposeSeekableReady) return false;

  audio._transposePendingSeekPct = Math.min(100, Math.max(0, Number(pct) || 0));
  el.progressFill.style.width = `${audio._transposePendingSeekPct}%`;

  if (!audio._transposeSeekToastShown) {
    audio._transposeSeekToastShown = true;
    toast('Preparando a música transposta. A posição será aplicada automaticamente.');
  }

  if (current) {
    watchTransposeReady(
      current,
      Number(audio._transposeSemitones || 0),
      audio._transposeAppwriteId || '',
      true
    );
  }
  return true;
}

// URLs diretas do Google Drive (browser acessa sem passar pelo servidor)
function driveDirectApiUrl(id){
  const key = (cfg && (cfg.DRIVE_API_KEY || cfg.API_KEY)) || '';
  if (!key) { try { return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&key=${localStorage.getItem('vs_drive_key')||''}`; } catch(_){} }
  return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&key=${encodeURIComponent(key)}`;
}
function driveDirectDownloadUrl(id){
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
}

function closePlayer(){
  clearTransposeReadyWatch();
  try { el.audio.pause(); } catch(_) {}
  randomContinuousMode = false;
  shuffleMode = false;
  repeatMode = false;
  el.shuffleBtn?.classList.remove('favorites-active');
  el.repeatBtn?.classList.remove('favorites-active');
  el.audio.removeAttribute('src');
  try { el.audio.load(); } catch(_) {}
  current = null;
  currentQueue = [];
  currentIndex = -1;
  document.body.classList.remove('player-visible');
  document.getElementById('playerArea')?.classList.add('player-hidden');
  el.nowTitle.textContent = 'Selecione uma música';
  el.nowSinger.textContent = 'Igreja Amor e Vida';
  el.nowCover.src = 'assets/logo-avida.jpg';
  syncProgressUI();
  setPlayButtonState(false);
}

function togglePlayPause(){
  if (!el.audio.src && allTracks.length) { playTrack(getFiltered()[0] || allTracks[0], 0, getFiltered()); return; }
  if (el.audio.paused) el.audio.play(); else el.audio.pause();
}
function playPrev(){
  const queue = currentQueue.length ? currentQueue : getFiltered();
  if (!queue.length) return;
  currentIndex = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
  playTrack(queue[currentIndex], null, queue, { randomContinuous: randomContinuousMode });
}
function playNext(){
  const queue = currentQueue.length ? currentQueue : getFiltered();
  if (!queue.length) return;
  currentIndex = shuffleMode ? Math.floor(Math.random() * queue.length) : (currentIndex >= queue.length - 1 ? 0 : currentIndex + 1);
  playTrack(queue[currentIndex], null, queue, { randomContinuous: randomContinuousMode });
}
function syncProgressUI(){
  const duration = Number.isFinite(el.audio.duration) ? el.audio.duration : 0;
  const currentTime = Number.isFinite(el.audio.currentTime) ? el.audio.currentTime : 0;
  const pendingSeekPct = Number.isFinite(el.audio._transposePendingSeekPct) && !el.audio._transposeSeekableReady
    ? Number(el.audio._transposePendingSeekPct)
    : null;
  const pct = pendingSeekPct !== null ? pendingSeekPct : (duration ? (currentTime / duration) * 100 : 0);
  // V123 — Não sobrescreve o valor da barra enquanto o usuário está arrastando,
  // senão a posição visual "briga" com o gesto e trava o arrasto.
  if (!isUserSeeking) {
    el.progressBar.value = pct;
    el.progressFill.style.width = `${pct}%`;
  }
  el.currentTime.textContent = formatTime(currentTime);
  el.durationTime.textContent = formatTime(duration);
}
function onSeek(){
  const duration = Number.isFinite(el.audio.duration) ? el.audio.duration : 0;
  // V123 — Atualiza o preenchimento visual imediatamente, mesmo sem duration ainda.
  const pct = Number(el.progressBar.value) || 0;
  el.progressFill.style.width = `${pct}%`;

  // V131.32 — Durante a primeira geração o stream progressivo não aceita Range.
  // Guarda o seek solicitado e troca automaticamente para o arquivo final assim
  // que ele estiver pronto, sem precisar atualizar a página.
  if (queueTransposeSeek(pct)) return;

  if (!duration) return;
  el.audio.currentTime = (pct / 100) * duration;
  el.currentTime.textContent = formatTime(el.audio.currentTime);
}
function formatTime(seconds){
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

function openToneModal(track){
  if (!track) return;
  toneTarget = track;

  const parsed = parseTone(track.key);
  const originalBase = parsed.base || 'C';
  const suffix = parsed.minor ? 'm' : '';
  const originalIndex = CHROMATIC_KEYS.indexOf(originalBase);

  selectedSemitone = 0;
  selectedToneLabel = parsed.base ? `${originalBase}${suffix}` : '';

  el.toneTrackName.textContent = track.name;
  el.toneCurrent.textContent = parsed.base ? formatKeyLabel(`${originalBase}${suffix}`) : 'Não detectado';
  if (el.toneSelected) el.toneSelected.textContent = parsed.base ? formatKeyLabel(`${originalBase}${suffix}`) : 'Escolha o tom';

  const helper = '<div class="tone-help">Escolha o tom desejado.</div>';

  el.toneButtons.innerHTML = helper + CHROMATIC_KEYS.map(key => {
    const semitone = calculateShortestShift(originalIndex >= 0 ? originalIndex : 0, CHROMATIC_KEYS.indexOf(key));
    const label = `${key}${suffix}`;
    const isOriginal = parsed.base && key === originalBase;
    // V98 — Nome curto + semitom em UMA linha. Ex: "C (dó) -1" ou "E (mi) original"
    const semitoneLabel = semitone === 0 ? 'original' : `${semitone > 0 ? '+' : ''}${semitone}`;
    return `
      <button class="tone-btn tone-btn-inline ${isOriginal ? 'active original' : ''}" data-key="${key}" data-step="${semitone}">
        <span class="tone-btn-name">${formatKeyLabelShort(label)}</span>
        <span class="tone-btn-step">${semitoneLabel}</span>
      </button>
    `;
  }).join('');

  el.toneButtons.querySelectorAll('.tone-btn').forEach(btn => btn.addEventListener('click', () => {
    selectedSemitone = Number(btn.dataset.step);
    selectedToneLabel = `${btn.dataset.key}${suffix}`;

    el.toneButtons.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (el.toneSelected) el.toneSelected.textContent = selectedToneLabel;
    el.downloadToneBtn.href = downloadUrl(track.id, track.name, selectedSemitone, appwriteFileIdFor(track));
    // V97 — textos curtos: o tom escolhido já fica nos info-strips acima
    el.playToneBtn.textContent = '▶ Ouvir Música';
    el.downloadToneBtn.textContent = '⤓ Baixar Música';
    if (el.addToneToSetlistBtn) el.addToneToSetlistBtn.textContent = '+ Adicionar ao repertório';
  }));

  el.downloadToneBtn.href = downloadUrl(track.id, track.name, 0);
  el.playToneBtn.textContent = '▶ Ouvir Música';
  el.downloadToneBtn.textContent = '⤓ Baixar Música';
  if (el.addToneToSetlistBtn) el.addToneToSetlistBtn.textContent = '+ Adicionar ao repertório';
  el.toneModal.classList.remove('hidden');
}

function parseTone(raw){
  if (!raw || raw === '—') return { base: null, minor: false };
  let value = String(raw).trim().replace('♯','#').replace('♭','b');
  const minor = /m$/.test(value);
  value = value.replace(/m$/,'').toUpperCase();
  if (FLAT_TO_SHARP[value]) value = FLAT_TO_SHARP[value];
  if (!CHROMATIC_KEYS.includes(value)) return { base: null, minor };
  return { base: value, minor };
}

function calculateShortestShift(fromIndex, toIndex){
  let diff = toIndex - fromIndex;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
}

function calculateToneLabel(originalTone, semitones){
  const parsed = parseTone(originalTone);
  if (!parsed.base || !semitones) return '';
  const from = CHROMATIC_KEYS.indexOf(parsed.base);
  const to = (from + Number(semitones) + 120) % 12;
  return `${CHROMATIC_KEYS[to]}${parsed.minor ? 'm' : ''}`;
}

function closeToneModal(){ el.toneModal.classList.add('hidden'); }

function toggleFavorite(id){
  if (favorites.includes(id)) favorites = favorites.filter(x => x !== id);
  else favorites.push(id);
  saveFavoritesState();
  updateFavoriteCount();
  render();
}
function updateFavoriteCount(){
  // V123 — totalFavorites e heroFavs foram removidos da página inicial na V121
  // (substituídos por "Próximos cultos"/"Próximo culto"). Checagem defensiva
  // evita erro caso algum desses elementos não exista mais no HTML.
  if (el.totalFavorites) el.totalFavorites.textContent = favorites.length;
  if (el.heroFavs) el.heroFavs.textContent = favorites.length;
  updateProfileModal();
}

function openSetlistModal(track, toneInfo = { semitones: 0, tone: '' }){
  setlistTarget = track;
  setlistTargetTone = { semitones: Number(toneInfo?.semitones || 0), tone: toneInfo?.tone || '' };
  const toneLabel = setlistTargetTone.tone && setlistTargetTone.semitones ? ` • Tom alterado: ${setlistTargetTone.tone}` : '';
  el.setlistTrackName.textContent = track ? `Adicionar ao repertório: ${track.name}${toneLabel}` : 'Escolha um repertório ou crie um novo.';
  el.newSetlistName.value = '';
  renderSetlistOptions();
  el.setlistModal.classList.remove('hidden');
}
function closeSetlistModal(){ el.setlistModal.classList.add('hidden'); }
// V108 — Verifica se um repertório deve ser arquivado automaticamente.
// Regras: tem eventDate E a data já passou (antes de hoje à meia-noite).
// V122 — Modal de edição de data de repertório
let editingSetlistId = null;

function openEditSetlistDate(setlistId){
  const s = setlists.find(x => x.id === setlistId);
  if (!s) return;
  editingSetlistId = setlistId;
  if (el.editSetlistDateTitle) el.editSetlistDateTitle.textContent = s.name;
  if (el.editSetlistDateInput) el.editSetlistDateInput.value = s.eventDate || '';
  if (el.editSetlistDateModal) {
    el.editSetlistDateModal.classList.remove('hidden');
    el.editSetlistDateInput?.focus();
  }
}

// V131.17 — Renomear repertório. Permite editar o nome, além de data e músicas.
function renameSetlist(setlistId){
  const s = setlists.find(x => x.id === setlistId);
  if (!s) return;
  if (!canEditSetlist(s)) {
    toast('Somente quem criou este repertório (ou um administrador) pode renomeá-lo.');
    return;
  }
  const novoNome = prompt('Novo nome do repertório:', s.name);
  if (novoNome === null) return; // cancelou
  const nomeLimpo = novoNome.trim();
  if (!nomeLimpo) {
    toast('O nome não pode ficar vazio.');
    return;
  }
  if (nomeLimpo === s.name) return; // não mudou
  s.name = nomeLimpo;
  s.updatedAt = new Date().toISOString();
  saveSetlistsState();
  renderSetlists();
  updateStats();
  // Se o detalhe deste repertório está aberto, atualiza o título
  if (currentSetlistDetailId && String(currentSetlistDetailId) === String(s.id)) {
    openSetlistDetail(s.id);
  }
  toast(`Repertório renomeado para "${nomeLimpo}".`);
}

function closeEditSetlistDateModal(){
  editingSetlistId = null;
  if (el.editSetlistDateModal) el.editSetlistDateModal.classList.add('hidden');
}

function saveSetlistDate(clear = false){
  const s = setlists.find(x => x.id === editingSetlistId);
  if (!s) return;
  if (!clear && !el.editSetlistDateInput?.value) {
    toast('Informe uma data válida para continuar.');
    el.editSetlistDateInput?.focus();
    return;
  }
  s.eventDate = clear ? '' : (el.editSetlistDateInput?.value || '');
  s.archived = false;
  s.updatedAt = new Date().toISOString();
  saveSetlistsState();
  renderSetlists();
  updateStats();
  closeEditSetlistDateModal();
  toast(clear ? 'Data removida do repertório.' : `Data definida: ${new Date(s.eventDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' })}.`);
}

function bindEditSetlistDateModal(){
  el.closeEditSetlistDate?.addEventListener('click', closeEditSetlistDateModal);
  el.saveSetlistDateBtn?.addEventListener('click', () => saveSetlistDate(false));
  el.clearSetlistDateBtn?.addEventListener('click', () => saveSetlistDate(true));
  el.editSetlistDateModal?.addEventListener('click', e => {
    if (e.target === el.editSetlistDateModal) closeEditSetlistDateModal();
  });
  // Enter salva
  el.editSetlistDateInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveSetlistDate(false);
    if (e.key === 'Escape') closeEditSetlistDateModal();
  });
}

function isSetlistAutoArchived(setlist){
  if (setlist.archived) return true;  // arquivado manualmente
  if (!setlist.eventDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(setlist.eventDate + 'T00:00:00');
  return event < today;
}

// Arquiva ou desarquiva manualmente um repertório.
function toggleSetlistArchive(setlistId){
  const s = setlists.find(x => x.id === setlistId);
  if (!s) return;
  if (!canEditSetlist(s)) {
    toast('Somente quem criou este repertório pode arquivá-lo.');
    return;
  }
  s.archived = !s.archived;
  s.updatedAt = new Date().toISOString();
  saveSetlistsState();
  renderSetlists();
  toast(s.archived ? 'Repertório arquivado.' : 'Repertório restaurado para ativos.');
}

function createSetlistFromInput(){
  if (!canCreateSetlists()) {
    toast('Faça login para criar repertórios.');
    return;
  }
  const name = el.newSetlistName.value.trim();
  if (!name) return toast('Informe o nome do repertório para continuar.');
  const eventDate = el.newSetlistDate?.value || '';
  if (!eventDate) {
    toast('Informe a data do culto para continuar.');
    el.newSetlistDate?.focus();
    return;
  }
  const creator = currentUserIdentity();
  const s = {
    // V131.17 — ID único robusto: timestamp + aleatório. Antes era só Date.now(),
    // que podia colidir se dois repertórios fossem criados no mesmo milissegundo
    // (causava o link abrir o repertório errado e itens "sumirem" no merge).
    id: `sl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name,
    trackIds: setlistTarget ? [makeSetlistEntry(setlistTarget, setlistTargetTone)] : [],
    createdById: creator.id,
    createdByEmail: creator.email,
    createdByName: creator.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    eventDate,   // V108 — "YYYY-MM-DD" ou vazio
    archived: false
  };
  setlists.push(s);
  saveSetlistsState();
  updateStats();
  renderSetlists();
  renderSetlistOptions();
  el.newSetlistName.value = '';
  if (el.newSetlistDate) el.newSetlistDate.value = '';  // V108
  recordUsageEvent({ type: 'setlist_created', setlistId: s.id, setlistName: s.name, trackCount: s.trackIds.length, message: `Repertório "${s.name}" criado.` });
  activateSetlistAndOpenLibrary(s);
  toast('Repertório criado. Adicione músicas na biblioteca.');
}
function renderSetlistOptions(){
  // V122 — Mostra apenas repertórios que o usuário pode editar.
  // Repertórios de outros usuários não aparecem mais neste modal.
  const editableSetlists = setlists.filter(s => canEditSetlist(s) && !isSetlistAutoArchived(s));

  if (!editableSetlists.length) {
    el.setlistOptions.innerHTML = '<div class="empty">Nenhum repertório seu ativo. Crie um novo acima.</div>';
    return;
  }
  el.setlistOptions.innerHTML = editableSetlists.map(s => {
    const dateLabel = s.eventDate
      ? new Date(s.eventDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' })
      : '';
    return `
      <div class="stack-item">
        <div>
          <strong>${esc(s.name)}</strong>
          <span>${countValidSetlistTracks(s)} música(s)${dateLabel ? ' • ' + dateLabel : ''}</span>
        </div>
        <button class="mini-btn add-to-setlist" data-id="${esc(s.id)}">Adicionar</button>
      </div>
    `;
  }).join('');
  el.setlistOptions.querySelectorAll('.add-to-setlist').forEach(btn => btn.addEventListener('click', () => {
    const setlist = setlists.find(s => s.id === btn.dataset.id);
    if (!setlist || !setlistTarget) return;
    addTrackToSetlist(setlist, setlistTarget, setlistTargetTone, { closeModal: true });
  }));
}

function renderSetlists(){
  const permissionNotice = authUser
    ? 'Todos podem ver e tocar os repertórios. Somente quem criou (ou administradores) pode editar ou excluir.'
    : 'Faça login para criar repertórios.';

  // V108 — separa ativos e arquivados
  const active   = setlists.filter(s => !isSetlistAutoArchived(s));
  const archived = setlists.filter(s =>  isSetlistAutoArchived(s));

  // V122 — Ordena ativos: com data (mais próxima primeiro) → sem data ao final (mais recente primeiro)
  active.sort((a, b) => {
    const aHas = !!a.eventDate, bHas = !!b.eventDate;
    if (aHas && bHas) return new Date(a.eventDate) - new Date(b.eventDate);
    if (aHas && !bHas) return -1;  // com data vem antes
    if (!aHas && bHas) return 1;   // sem data vai ao final
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); // sem data: mais recente primeiro
  });
  // Ordena arquivados: mais recente primeiro
  archived.sort((a, b) => {
    const ad = a.eventDate || a.updatedAt || a.createdAt;
    const bd = b.eventDate || b.updatedAt || b.createdAt;
    return new Date(bd) - new Date(ad);
  });

  function setlistCardHTML(s, isArchived = false){
    const owner = isSetlistOwner(s);
    const dateLabel = s.eventDate
      ? new Date(s.eventDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit', year:'numeric' })
      : '';
    const paletteMarkup = s.paletteTitle ? `
      <div class="setlist-palette">
        <img src="${esc(s.paletteImage || 'assets/logo-avida.jpg')}" alt="${esc(s.paletteTitle)}">
        <div class="setlist-palette-copy">
          <span class="setlist-palette-label">Paleta do culto</span>
          <strong>${esc(s.paletteTitle)}</strong>
        </div>
      </div>` : `
      <div class="setlist-palette is-empty">
        <img src="assets/logo-avida.jpg" alt="Paleta ainda não definida">
        <div class="setlist-palette-copy">
          <span class="setlist-palette-label">Paleta do culto</span>
          <strong>Não definida</strong>
        </div>
      </div>`;
    return `
      <article class="setlist-card ${owner ? 'is-owner' : 'is-readonly'} ${isArchived ? 'is-archived' : ''}">
        <strong>${esc(s.name)}</strong>
        ${dateLabel ? `<div class="setlist-event-date"><span class="setlist-date-chip">📅 ${esc(dateLabel)}</span></div>` : ''}
        <div class="muted">${countValidSetlistTracks(s)} música(s) • ${esc(getSetlistCreatorName(s))}</div>
        <div class="setlist-inline-meta">
          <span class="setlist-chip ${s.paletteTitle ? '' : 'is-empty'}">${s.paletteTitle ? `Paleta: ${esc(s.paletteTitle)}` : 'Paleta pendente'}</span>
        </div>
        ${paletteMarkup}
        <div class="setlist-actions setlist-actions-row1">
          <button class="mini-btn play-setlist play-setlist-text" data-id="${esc(s.id)}" aria-label="Tocar repertório" title="Tocar repertório">▶ Tocar</button>
          <button class="mini-btn open-setlist" data-id="${esc(s.id)}">Playlist</button>
          <button class="mini-btn share-setlist" data-id="${esc(s.id)}">Compartilhar</button>
          <button class="mini-btn notify-setlist" data-id="${esc(s.id)}">Notificar</button>
        </div>
        ${canEditSetlist(s) || canDeleteSetlist(s) ? `
        <div class="setlist-actions setlist-actions-row2">
          ${canEditSetlist(s) ? `<button class="mini-btn add-songs-setlist" data-id="${esc(s.id)}">➕ Adicionar músicas</button>` : ''}
          ${canEditSetlist(s) ? `<button class="mini-btn rename-setlist" data-id="${esc(s.id)}">✏️ Renomear</button>` : ''}
          ${canEditSetlist(s) ? `<button class="mini-btn edit-setlist-date" data-id="${esc(s.id)}">📅 ${s.eventDate ? 'Alterar data' : 'Definir data'}</button>` : ''}
          ${canEditSetlist(s) ? `<button class="mini-btn archive-setlist" data-id="${esc(s.id)}" title="${isArchived ? 'Restaurar' : 'Arquivar'}">${isArchived ? '↩ Restaurar' : '📦 Arquivar'}</button>` : ''}
          ${canDeleteSetlist(s) ? `<button class="mini-btn delete-setlist" data-id="${esc(s.id)}">🗑 Excluir</button>` : ''}
        </div>` : ''}
      </article>
    `;
  }

  function bindSetlistGrid(container){
    container.querySelectorAll('.play-setlist').forEach(btn => btn.addEventListener('click', () => playSetlistById(btn.dataset.id)));
    container.querySelectorAll('.open-setlist').forEach(btn => btn.addEventListener('click', () => { sharedSetlistContextId = null; openSetlistDetail(btn.dataset.id); }));
    container.querySelectorAll('.share-setlist').forEach(btn => btn.addEventListener('click', () => {
      const setlist = setlists.find(s => s.id === btn.dataset.id);
      if (setlist) shareSetlistWithPaletteCheck(setlist);
    }));
    container.querySelectorAll('.notify-setlist').forEach(btn => btn.addEventListener('click', () => {
      notifySetlistDefined(setlists.find(s => s.id === btn.dataset.id));
    }));
    container.querySelectorAll('.archive-setlist').forEach(btn => btn.addEventListener('click', () => toggleSetlistArchive(btn.dataset.id)));
    container.querySelectorAll('.edit-setlist-date').forEach(btn => btn.addEventListener('click', () => openEditSetlistDate(btn.dataset.id)));
    container.querySelectorAll('.rename-setlist').forEach(btn => btn.addEventListener('click', () => renameSetlist(btn.dataset.id)));
    container.querySelectorAll('.add-songs-setlist').forEach(btn => btn.addEventListener('click', () => startAddSongsToSetlist(btn.dataset.id)));
    container.querySelectorAll('.delete-setlist').forEach(btn => btn.addEventListener('click', () => {
      const setlist = setlists.find(s => s.id === btn.dataset.id);
      if (!canDeleteSetlist(setlist)) { toast('Somente quem criou este repertório pode excluí-lo.'); return; }
      if (!confirm('Excluir este repertório permanentemente?')) return;
      const deletedId = btn.dataset.id;
      if (activeSetlistId === deletedId) clearActiveSetlist();
      // V131.18 — Remove o documento da collection (não só do array local)
      deleteSingleSetlist(deletedId);
      updateStats();
      renderSetlists();
      render();
    }));
    container.querySelectorAll('.setlist-card').forEach(card => card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const openBtn = card.querySelector('.open-setlist');
      if (openBtn?.dataset?.id) openSetlistDetail(openBtn.dataset.id);
    }));
  }

  // Renderiza seção de ativos
  if (!active.length) {
    el.setlistsGrid.innerHTML = `<div class="empty empty-polished"><strong>Nenhum repertório ativo.</strong><span>${permissionNotice}</span>${authUser ? '<button class="btn btn-primary btn-compact" type="button" onclick="document.getElementById(\'newSetlistBtn\')?.click()">+ Criar repertório</button>' : ''}</div>`;
  } else {
    el.setlistsGrid.innerHTML = `<div class="setlist-permission-note">${permissionNotice}</div>` + active.map(s => setlistCardHTML(s, false)).join('');
    bindSetlistGrid(el.setlistsGrid);
  }

  // Renderiza seção de arquivados
  if (el.archivedSetlistsSection && el.archivedSetlistsGrid) {
    if (!archived.length) {
      el.archivedSetlistsSection.style.display = 'none';
    } else {
      el.archivedSetlistsSection.style.display = '';
      if (el.archivedSetlistsCount) el.archivedSetlistsCount.textContent = String(archived.length);
      el.archivedSetlistsGrid.innerHTML = archived.map(s => setlistCardHTML(s, true)).join('');
      bindSetlistGrid(el.archivedSetlistsGrid);
    }
  }
}
function playSetlistById(id){
  const setlist = setlists.find(s => s.id === id);
  if (!setlist) return;
  const tracks = mapSetlistTracks(setlist);
  if (tracks.length) playTrack(tracks[0], null, tracks);
}
function mapSetlistTracks(setlist){
  return (setlist.trackIds || []).map(entry => {
    const id = getSetlistEntryTrackId(entry);
    const base = findTrack(id);
    if (!base) return null;
    const semitones = getSetlistEntrySemitones(entry);
    const tone = getSetlistEntryTone(entry) || calculateToneLabel(base.key, semitones);
    return {
      ...base,
      repertoireSemitones: semitones,
      repertoireTone: tone
    };
  }).filter(Boolean);
}

// V131.5 — Conta apenas músicas que existem na biblioteca.
// Evita a discrepância "card mostra 5, playlist mostra 4" quando um trackId
// salvo no repertório não existe mais na biblioteca (ex: ID mudou no Drive).
// Se a biblioteca ainda não carregou, retorna o total bruto (não temos como saber).
function countValidSetlistTracks(setlist){
  if (!allTracks.length) return (setlist.trackIds || []).length;
  return (setlist.trackIds || []).filter(entry => {
    const id = getSetlistEntryTrackId(entry);
    return !!findTrack(id);
  }).length;
}

// V131.5 — Remove IDs órfãos (músicas que não existem mais na biblioteca)
// de todos os repertórios. Roda após a biblioteca carregar. Corrige o caso
// onde uma música foi re-adicionada e a antiga ficou duplicada na contagem.
function cleanOrphanSetlistTracks(){
  if (!allTracks.length) return; // só limpa com biblioteca carregada
  let changed = false;
  for (const setlist of setlists) {
    const original = setlist.trackIds || [];
    const cleaned = original.filter(entry => {
      const id = getSetlistEntryTrackId(entry);
      return !!findTrack(id);
    });
    if (cleaned.length !== original.length) {
      setlist.trackIds = cleaned;
      setlist.updatedAt = new Date().toISOString();
      changed = true;
      console.info(`[setlist] ${original.length - cleaned.length} música(s) órfã(s) removida(s) de "${setlist.name}"`);
    }
  }
  if (changed) {
    saveSetlistsState();
    renderSetlists();
    updateStats();
  }
}

function makeSetlistEntry(track, toneInfo = { semitones: 0, tone: '' }){
  const semitones = Number(toneInfo?.semitones || 0);
  const tone = toneInfo?.tone || '';
  if (!semitones && !tone) return track.id;
  return { trackId: track.id, semitones, tone };
}
function getSetlistEntryTrackId(entry){ return typeof entry === 'string' ? entry : entry?.trackId; }
function getSetlistEntrySemitones(entry){ return typeof entry === 'string' ? 0 : Number(entry?.semitones || 0); }
function getSetlistEntryTone(entry){ return typeof entry === 'string' ? '' : (entry?.tone || ''); }
function setlistHasEntry(setlist, newEntry){
  const newId = getSetlistEntryTrackId(newEntry);
  const newSemitone = getSetlistEntrySemitones(newEntry);
  const newTone = getSetlistEntryTone(newEntry);
  return (setlist.trackIds || []).some(entry =>
    getSetlistEntryTrackId(entry) === newId &&
    getSetlistEntrySemitones(entry) === newSemitone &&
    getSetlistEntryTone(entry) === newTone
  );
}

function buildSetlistShareUrl(setlistId){
  return `${location.origin}${location.pathname}?setlist=${encodeURIComponent(setlistId)}`;
}
function formatSetlistDate(value){
  if (!value) return 'Data não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return date.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function renderSharedSetlistHero(setlist){
  if (!el.setlistSharedHero) return;
  const isSharedView = String(sharedSetlistContextId || '') === String(setlist?.id || '');
  if (!isSharedView || !setlist) {
    el.setlistSharedHero.classList.add('hidden');
    el.setlistSharedHero.innerHTML = '';
    return;
  }
  const trackCount = countValidSetlistTracks(setlist);
  const creatorName = getSetlistCreatorName(setlist);
  const paletteTitle = setlist.paletteTitle || 'Paleta ainda não definida';
  const createdAt = formatSetlistDate(setlist.createdAt);
  el.setlistSharedHero.classList.remove('hidden');
  el.setlistSharedHero.innerHTML = `
    <div class="setlist-shared-hero-card glass-lite">
      <div class="setlist-shared-brand">
        <img src="assets/logo-avida.jpg" alt="Igreja Amor e Vida">
        <div>
          <span class="setlist-shared-label">Igreja Amor e Vida</span>
          <strong>Repertório compartilhado</strong>
          <small>Confira as músicas e a paleta definida para este culto.</small>
        </div>
      </div>
      <div class="setlist-shared-main">
        <div class="setlist-shared-copy">
          <h4>${esc(setlist.name || 'Repertório')}</h4>
          <div class="setlist-shared-meta">
            <span class="shared-meta-pill">${trackCount} música(s)</span>
            <span class="shared-meta-pill">Criado por ${esc(creatorName)}</span>
            <span class="shared-meta-pill">${esc(createdAt)}</span>
          </div>
          <div class="setlist-shared-palette-line">
            <span class="shared-palette-chip">${esc(paletteTitle)}</span>
            <small>Use esta paleta como referência de uniforme para o culto.</small>
          </div>
        </div>
        <div class="setlist-shared-actions">
          <button type="button" class="btn btn-primary hero-open-palette">Ver paleta do culto</button>
          <button type="button" class="btn btn-secondary hero-copy-link">Copiar link</button>
        </div>
      </div>
    </div>`;
  const openPaletteBtn = el.setlistSharedHero.querySelector('.hero-open-palette');
  if (openPaletteBtn) openPaletteBtn.addEventListener('click', () => {
    if (setlist.paletteImage) openPaletteModal(setlist.paletteTitle || 'Paleta do culto', setlist.paletteImage, setlist.paletteId || '');
    else toast('Este repertório ainda não possui paleta definida.');
  });
  const copyLinkBtn = el.setlistSharedHero.querySelector('.hero-copy-link');
  if (copyLinkBtn) copyLinkBtn.addEventListener('click', () => copyText(buildSetlistShareUrl(setlist.id), 'Link do repertório copiado.'));
}

function openSetlistDetail(id){
  currentSetlistDetailId = id;
  const setlist = setlists.find(s => s.id === id);
  if (!setlist) return;
  const owner = canEditSetlist(setlist);
  const isSharedView = String(sharedSetlistContextId || '') === String(id);
  el.setlistDetailTitle.textContent = setlist.name;
  const detailIntro = el.setlistDetailIntro;
  const trackCount = countValidSetlistTracks(setlist);
  const creatorName = getSetlistCreatorName(setlist);
  if (detailIntro) {
    if (isSharedView) {
      detailIntro.textContent = `Repertório compartilhado com ${trackCount} música(s) • Criado por ${creatorName}.`;
    } else {
      detailIntro.textContent = owner
        ? `Playlist com ${trackCount} música(s) • Criado por ${creatorName}. Você pode tocar, reordenar e editar este repertório.`
        : `Playlist com ${trackCount} música(s) • Criado por ${creatorName}. Repertório em modo leitura para você.`;
    }
  }
  const canEdit = canEditSetlist(setlist);
  if (el.addMusicSetlistDetail) el.addMusicSetlistDetail.classList.toggle('hidden', !canEdit);
  // V131.25 — O botão "🎨 Paleta" fica visível para TODOS (é visualização);
  // a ação de trocar, dentro do modal, é que fica restrita a quem pode editar.
  if (el.changeSetlistPaletteBtn) el.changeSetlistPaletteBtn.classList.remove('hidden');

  renderSharedSetlistHero(setlist);
  renderSetlistDetailTracks();
  el.setlistDetailModal.classList.remove('hidden');

  const modalCard = el.setlistDetailModal.querySelector('.modal-card');
  modalCard?.classList.toggle('is-shared-setlist-view', isSharedView);

  // V124 — No modo compartilhado, embrulha hero + ações + paleta + faixas
  // num único scroll-zone para evitar corte do hero pelo max-height do modal.
  if (isSharedView && modalCard) {
    // Remove scroll-zone anterior se existir
    const existing = modalCard.querySelector('.setlist-shared-scroll-zone');
    if (existing) {
      while (existing.firstChild) existing.before(existing.firstChild);
      existing.remove();
    }
    // Cria nova scroll-zone e move o conteúdo variável para dentro dela
    const scrollZone = document.createElement('div');
    scrollZone.className = 'setlist-shared-scroll-zone';
    const hero = el.setlistSharedHero;
    const actionsTop = modalCard.querySelector('.modal-actions-top');
    const palette = document.getElementById('setlistDetailPalette');
    const tracks = document.getElementById('setlistDetailTracks');
    // Insere o scroll-zone antes do hero
    if (hero && hero.parentNode === modalCard) {
      modalCard.insertBefore(scrollZone, hero);
      scrollZone.appendChild(hero);
      if (actionsTop) scrollZone.appendChild(actionsTop);
      if (palette) scrollZone.appendChild(palette);
      if (tracks) scrollZone.appendChild(tracks);
    }
  }
}
function closeSetlistDetail(){
  el.setlistDetailModal.classList.add('hidden');
  el.setlistSharedHero?.classList.add('hidden');
  if (el.setlistSharedHero) el.setlistSharedHero.innerHTML = '';
  const modalCard = el.setlistDetailModal.querySelector('.modal-card');
  modalCard?.classList.remove('is-shared-setlist-view');
  sharedSetlistContextId = null;

  // V124 — Restaura estrutura original (remove scroll-zone e move elementos de volta)
  if (modalCard) {
    const scrollZone = modalCard.querySelector('.setlist-shared-scroll-zone');
    if (scrollZone) {
      while (scrollZone.firstChild) scrollZone.before(scrollZone.firstChild);
      scrollZone.remove();
    }
  }
}
// V131.25 — A paleta agora é exibida num MODAL próprio (aberto pelo botão
// "🎨 Paleta"), em vez de um box inline que embolava o layout mobile.
function openSetlistPaletteView(setlist){
  if (!el.setlistPaletteViewModal || !el.setlistPaletteViewBody) return;
  const hasPalette = Boolean(setlist?.paletteTitle);
  const img = setlist?.paletteImage || 'assets/logo-avida.jpg';
  const title = setlist?.paletteTitle || 'Paleta ainda não definida';
  const canEdit = canEditSetlist(setlist);
  const helper = hasPalette
    ? 'Esta é a paleta vinculada a este repertório — o uniforme visual do culto.'
    : (canEdit ? 'Escolha uma paleta para definir o uniforme visual do culto.' : 'O criador ainda não definiu uma paleta para este repertório.');
  if (el.setlistPaletteViewTitle) el.setlistPaletteViewTitle.textContent = setlist?.name || 'Paleta';
  el.setlistPaletteViewBody.innerHTML = `
    <div class="setlist-detail-palette-card ${hasPalette ? '' : 'is-empty'}">
      <img src="${esc(img)}" alt="${esc(title)}">
      <div class="setlist-detail-palette-copy">
        <span class="setlist-palette-label">Paleta do culto</span>
        <strong>${esc(title)}</strong>
        <small>${esc(helper)}</small>
      </div>
    </div>`;
  if (el.setlistPaletteViewChangeBtn) el.setlistPaletteViewChangeBtn.classList.toggle('hidden', !canEdit);
  el.setlistPaletteViewModal.classList.remove('hidden');
}
function closeSetlistPaletteView(){
  if (el.setlistPaletteViewModal) el.setlistPaletteViewModal.classList.add('hidden');
}
function renderSetlistDetailTracks(){
  const setlist = setlists.find(s => s.id === currentSetlistDetailId);
  if (!setlist) return;
  const tracks = mapSetlistTracks(setlist);
  if (!tracks.length) {
    el.setlistDetailTracks.innerHTML = '<div class="empty">Este repertório ainda não possui músicas.</div>';
    return;
  }
  const owner = canEditSetlist(setlist);
  el.setlistDetailTracks.innerHTML = tracks.map((track, index) => {
    const chosenTone = formatKeyLabel(track.repertoireTone || track.key || '—');
    const toneLabel = track.repertoireTone ? 'Tom escolhido' : 'Tom';
    const toneClass = track.repertoireTone ? 'is-altered' : 'is-original';

    return `
      <div class="reorder-item setlist-song-card ${owner ? '' : 'is-readonly'}" draggable="${owner ? 'true' : 'false'}" data-id="${esc(track.id)}" data-index="${index}">
        <div class="setlist-song-main">
          ${owner ? '<span class="drag-handle">⋮⋮</span>' : ''}
          <div class="setlist-song-info">
            <strong>${index + 1}. ${esc(track.name)}</strong>
            <span class="setlist-song-tone ${toneClass}">${esc(toneLabel)}: ${esc(chosenTone)}</span>
          </div>
        </div>
        <div class="row-actions">
          <button class="mini-btn play-one" data-id="${esc(track.id)}" aria-label="Tocar música" title="Tocar música"><span class="play-glyph" aria-hidden="true">▶</span></button>
          ${owner ? `<button class="mini-btn remove-one" data-id="${esc(track.id)}">Remover</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
  bindReorderEvents();
  el.setlistDetailTracks.querySelectorAll('.play-one').forEach(btn => {
    const getTrack = () => {
      const idx = Number(btn.closest('.reorder-item')?.dataset.index || 0);
      return tracks[idx];
    };
    btn.addEventListener('touchstart', () => prewarmTrackAudio(getTrack()), { passive: true });
    btn.addEventListener('mouseenter', () => prewarmTrackAudio(getTrack()));
    btn.addEventListener('click', () => {
      const track = getTrack();
      if (track) {
        btn.classList.add('is-loading');
        playTrack(track, null, tracks);
        setTimeout(() => { btn.classList.remove('is-loading'); }, 900);
      }
    });
  });
  el.setlistDetailTracks.querySelectorAll('.remove-one').forEach(btn => btn.addEventListener('click', () => {
    if (!canEditSetlist(setlist)) {
      toast('Somente quem criou este repertório (ou um administrador) pode editá-lo.');
      return;
    }
    const idx = Number(btn.closest('.reorder-item')?.dataset.index);
    if (!Number.isInteger(idx) || idx < 0) return;
    // V131.12 — Confirmação antes de remover a música do repertório
    const trackName = tracks[idx]?.name || 'esta música';
    if (!confirm(`Remover "${trackName}" deste repertório?`)) return;
    setlist.trackIds.splice(idx, 1);
    saveSetlistsState();
    renderSetlists();
    renderSetlistDetailTracks();
    updateStats();
    toast('Música removida do repertório.');
  }));
}
function bindReorderEvents(){
  const setlist = setlists.find(s => s.id === currentSetlistDetailId);
  if (!canEditSetlist(setlist)) return;
  const items = [...el.setlistDetailTracks.querySelectorAll('.reorder-item')];
  let draggedIndex = null;
  items.forEach(item => {
    item.addEventListener('dragstart', () => { draggedIndex = Number(item.dataset.index); item.classList.add('dragging'); });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', e => e.preventDefault());
    item.addEventListener('drop', e => {
      e.preventDefault();
      const targetIndex = Number(item.dataset.index);
      if (!Number.isInteger(draggedIndex) || !Number.isInteger(targetIndex) || draggedIndex === targetIndex) return;
      reorderSetlist(currentSetlistDetailId, draggedIndex, targetIndex);
      renderSetlistDetailTracks();
      renderSetlists();
    });
  });
}
function reorderSetlist(setlistId, from, to){
  const setlist = setlists.find(s => s.id === setlistId);
  if (!setlist) return;
  if (from < 0 || to < 0 || from >= setlist.trackIds.length || to >= setlist.trackIds.length) return;
  const [moved] = setlist.trackIds.splice(from, 1);
  setlist.trackIds.splice(to, 0, moved);
  saveSetlistsState();
}

function openSongModal(track){
  if (!track) return;
  songModalTarget = track;
  el.songModalCover.src = track.coverUrl || 'assets/logo-avida.jpg';
  el.songModalTitle.textContent = track.name;
  el.songModalSubtitle.textContent = track.singer;
  const alteredTone = track.repertoireTone || '';
  el.songModalMeta.innerHTML = `
    <span class="meta key">Tom original: ${esc(formatKeyLabel(track.key || '—'))}</span>
    <span class="meta altered-tone">Tom alterado: ${alteredTone ? esc(alteredTone) : '—'}</span>
  `;
  el.songModalTags.innerHTML = (track.tags || []).map(tag => `<span class="tag">${esc(tag)}</span>`).join('');
  el.songModalFavorite.textContent = favorites.includes(track.id) ? '♥ Favorita' : '♡ Favoritar';
  // V95 — botão de download direto no modal de detalhes
  if (el.songModalDownload) {
    el.songModalDownload.href = downloadUrl(track.id, track.name, 0);
  }
  el.songModal.classList.remove('hidden');
}
function closeSongModal(){ el.songModal.classList.add('hidden'); }

function shareTrack(track){
  if (!track) return;
  copyText(`${location.origin}${location.pathname}?track=${encodeURIComponent(track.id)}`, 'Link da música copiado.');
}

function readDeepLinks(){
  const params = new URLSearchParams(location.search);
  const trackId = params.get('track');
  const setlistId = params.get('setlist');

  if (trackId) {
    const track = findTrack(trackId);
    if (track) {
      location.hash = '#biblioteca';
      routeInternalPage();
      el.search.value = track.name;
      render();
      setTimeout(() => playTrack(track, 0, [track]), 200);
    }
  }

  if (setlistId) {
    // V131.17 — Abre o repertório do link com retry robusto. Antes tentava só
    // 2x e falhava se os setlists ainda não tivessem carregado da nuvem (ou abria
    // errado por colisão de ID, agora resolvida com IDs únicos). Agora tenta por
    // até ~8 segundos, esperando o carregamento completar.
    let tentativas = 0;
    const maxTentativas = 16; // 16 x 500ms = 8s
    const openSharedSetlist = () => {
      const setlist = setlists.find(s => String(s.id) === String(setlistId));
      if (!setlist) return false;

      location.hash = '#inicio';
      routeInternalPage();
      document.body.classList.remove('player-visible');
      document.getElementById('playerArea')?.classList.add('player-hidden');

      sharedSetlistContextId = setlist.id;
      setTimeout(() => openSetlistDetail(setlist.id), 250);
      return true;
    };

    const tentarAbrir = () => {
      if (openSharedSetlist()) return; // conseguiu
      tentativas++;
      if (tentativas < maxTentativas) {
        setTimeout(tentarAbrir, 500);
      } else {
        toast('Repertório não encontrado. Ele pode ter sido removido ou o link está incorreto.');
      }
    };
    tentarAbrir();
  }
}

function copyText(text, message){
  navigator.clipboard.writeText(text).then(() => toast(message)).catch(() => alert(text));
}
function toast(message){
  document.querySelector('.toast')?.remove();
  const div = document.createElement('div');
  div.className = 'toast toast-pro';
  div.innerHTML = `<span class="toast-icon">✓</span><span>${esc(message)}</span>`;
  document.body.appendChild(div);
  setTimeout(() => div.classList.add('is-visible'), 20);
  setTimeout(() => div.remove(), 2400);
}

function toggleTheme(){
  const next = document.body.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  saveJSON('vs_theme_v1', next);
}
function applyTheme(theme){
  document.body.dataset.theme = theme;
  el.themeToggle.textContent = theme === 'light' ? '☾' : '☼';
  el.themeToggle.title = theme === 'light' ? 'Usar modo escuro' : 'Usar modo claro';
}

/* ============================================================
   V120 — Painel Admin: membros cadastrados + log de acessos
   Visível apenas para admins (isScheduleAdmin()).
   ============================================================ */

// Exibe/esconde o link Admin no menu conforme permissão
function updateAdminNavVisibility(){
  if (!el.adminNavLink) return;
  el.adminNavLink.classList.toggle('hidden', !isScheduleAdmin());
}

// Inicializa o painel admin (binds de botões)
function initAdminPage(){
  if (el.adminRefreshBtn) {
    el.adminRefreshBtn.addEventListener('click', loadAdminData);
  }
}

// Carrega dados do servidor e renderiza
async function loadAdminData(){
  if (!isScheduleAdmin()) return;
  if (el.adminLoadingMsg) el.adminLoadingMsg.style.display = '';
  if (el.adminUsersWrap) el.adminUsersWrap.style.display = 'none';

  try {
    // Carrega usuários e log em paralelo
    const [usersRes, logRes] = await Promise.all([
      fetch('/api/admin/users?limit=200'),
      fetch('/api/admin/access-log')
    ]);

    // Usuários
    if (usersRes.ok) {
      const data = await usersRes.json();
      renderAdminUsers(data.users || [], data.total || 0, data.notice || '');
    } else {
      const errText = await usersRes.text().catch(() => '');
      renderAdminError(`Não foi possível carregar os membros (${usersRes.status}). Verifique os logs do Render.`);
    }

    // Log de acessos
    if (logRes.ok) {
      const logData = await logRes.json();
      renderAdminLog(logData.entries || []);
    }
  } catch(e) {
    renderAdminError('Erro de conexão: ' + e.message);
  } finally {
    if (el.adminLoadingMsg) el.adminLoadingMsg.style.display = 'none';
  }
}

function renderAdminUsers(users, total, notice = ''){
  if (!el.adminUsersBody) return;
  if (el.adminUserCount) el.adminUserCount.textContent = `${total} membro${total !== 1 ? 's' : ''}`;

  // Aviso quando dados vêm do log (não do Appwrite Users API)
  const noticeHtml = notice
    ? `<div style="margin-bottom:12px;padding:10px 14px;background:rgba(255,180,0,.08);border:1px solid rgba(255,180,0,.2);border-radius:10px;font-size:12px;color:#ffb400">⚠️ ${esc(notice)}</div>`
    : '';

  if (!users.length) {
    el.adminUsersBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--muted)">Nenhum acesso registrado nesta sessão.</td></tr>';
    if (el.adminUsersWrap) { el.adminUsersWrap.querySelector('.admin-notice')?.remove(); el.adminUsersWrap.insertAdjacentHTML('beforebegin', noticeHtml); el.adminUsersWrap.style.display = ''; }
    return;
  }

  const rows = users.map(u => {
    const createdAt = u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
    const accessedAt = u.accessedAt ? new Date(u.accessedAt).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Nunca';
    const statusBadge = u.status
      ? '<span class="admin-badge admin-badge-ok">Ativo</span>'
      : '<span class="admin-badge admin-badge-off">Inativo</span>';
    const isAdmin = isScheduleAdmin() && cloudAdminEmails.includes(String(u.email || '').toLowerCase());
    const roleBadge = isAdmin ? ' <span class="admin-badge admin-badge-admin">Admin</span>' : '';
    return `
      <tr>
        <td><strong>${esc(u.name || '—')}</strong>${roleBadge}</td>
        <td class="admin-email">${esc(u.email || '—')}</td>
        <td>${createdAt}</td>
        <td>${accessedAt}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');

  el.adminUsersBody.innerHTML = rows;
  if (el.adminUsersWrap) el.adminUsersWrap.style.display = '';
}

function renderAdminLog(entries){
  if (!el.adminAccessLog) return;
  if (!entries.length) {
    el.adminAccessLog.innerHTML = '<p style="color:var(--muted);padding:8px 0">Nenhum acesso registrado nesta sessão do servidor.</p>';
    return;
  }
  const rows = entries.slice(0, 50).map(e => {
    const at = e.at ? new Date(e.at).toLocaleString('pt-BR') : '—';
    const typeLabel = e.type === 'register' ? '📝 Cadastro' : '🔑 Login';
    const typeCls = e.type === 'register' ? 'admin-badge-new' : 'admin-badge-ok';
    return `
      <div class="admin-log-row">
        <span class="admin-badge ${typeCls}">${typeLabel}</span>
        <strong>${esc(e.name || e.email || '—')}</strong>
        <span class="admin-email">${esc(e.email || '')}</span>
        <span class="admin-log-time">${at}</span>
      </div>
    `;
  }).join('');
  el.adminAccessLog.innerHTML = rows;
}

function renderAdminError(msg){
  if (el.adminUsersBody) el.adminUsersBody.innerHTML = `<tr><td colspan="5" style="color:#ff8080;padding:20px">${esc(msg)}</td></tr>`;
  if (el.adminUsersWrap) el.adminUsersWrap.style.display = '';
}

// Hook na navegação: carrega dados ao entrar na página admin
function maybeLoadAdminOnNav(hash){
  if (hash === '#adminPage' && isScheduleAdmin()) {
    loadAdminData();
  }
}
