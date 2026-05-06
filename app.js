
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
let repeatMode = false;
let shuffleMode = false;
let randomContinuousMode = false;
let selectedSemitone = 0;
let selectedToneLabel = '';
let toneTarget = null;
let setlistTarget = null;
let setlistTargetTone = { semitones: 0, tone: '' };
let currentSetlistDetailId = null;
let songModalTarget = null;
let favorites = loadJSON('vs_favorites_v1', []);
let setlists = loadJSON('vs_setlists_v1', []);
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
const DEFAULT_MEMBERS = ["Alessandro", "Ana Caroline", "Antônio", "Caroline", "Dafnis", "Daniel", "Daniele", "Douglas", "Edimar", "Edmilson", "Edvanio", "Fábio", "Izabel", "Laryssa", "Leandro", "Letícia", "Ludmilla", "Luis", "Márcia", "Marcinho", "Mariah", "Mayra", "Pr Douglas", "Rayssa", "Tales", "Thelma", "Thiagão", "Thiago Matos"];
let scheduleRows = DEFAULT_scheduleRows.map(row => ({...row}));
let members = [...DEFAULT_MEMBERS];
let cloudAdminEmails = [];
let cloudAdminConfigured = false;
let scheduleDirty = false;
const SCHEDULE_ROLE_LABELS = {
  minister: 'Ministro', back1: 'Back', back2: 'Back', back3: 'Back', bass: 'Baixo', drums: 'Bateria', guitar: 'Guitarra', keyboard: 'Teclado', sound: 'Tec. Som'
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
const TOUR_STEPS = [
  { hash: '#inicio', selector: '[data-tour="search"]', title: 'Busca inteligente', description: 'Comece por aqui para encontrar músicas por nome, cantor/pasta, tom, tag ou arquivo.' },
  { hash: '#inicio', selector: '[data-tour="hero"]', title: 'Área principal', description: 'Aqui estão os atalhos mais importantes, indicadores rápidos e acesso ao player aleatório.' },
  { hash: '#biblioteca', selector: '[data-tour="filters"]', title: 'Filtros inteligentes', description: 'Refine a biblioteca por música, tom, tag, tipo de arquivo e favoritas.' },
  { hash: '#biblioteca', selector: '[data-tour="library"]', title: 'Biblioteca de músicas', description: 'Alterne entre Miniaturas e Detalhes e role a tela para carregar mais músicas automaticamente.' },
  { hash: '#repertorios', selector: '[data-tour="setlists"]', title: 'Repertórios por culto', description: 'Crie repertórios, organize a ordem das músicas e compartilhe listas com a equipe.' },
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
  createSetlistBtn: document.getElementById('createSetlistBtn'),
  setlistOptions: document.getElementById('setlistOptions'),

  setlistDetailModal: document.getElementById('setlistDetailModal'),
  closeSetlistDetail: document.getElementById('closeSetlistDetail'),
  setlistDetailTitle: document.getElementById('setlistDetailTitle'),
  setlistDetailTracks: document.getElementById('setlistDetailTracks'),
  playSetlistDetail: document.getElementById('playSetlistDetail'),
  shareSetlistDetail: document.getElementById('shareSetlistDetail'),

  songModal: document.getElementById('songModal'),
  closeSongModal: document.getElementById('closeSongModal'),
  songModalCover: document.getElementById('songModalCover'),
  songModalTitle: document.getElementById('songModalTitle'),
  songModalSubtitle: document.getElementById('songModalSubtitle'),
  songModalMeta: document.getElementById('songModalMeta'),
  songModalTags: document.getElementById('songModalTags'),
  songModalPlay: document.getElementById('songModalPlay'),
  songModalFavorite: document.getElementById('songModalFavorite'),
  songModalTone: document.getElementById('songModalTone'),
  songModalShare: document.getElementById('songModalShare'),
  tutorialStartBtn: document.getElementById('tutorialStartBtn'),
  tutorialPageStartBtn: document.getElementById('tutorialPageStartBtn'),
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
  loginScreen: document.getElementById('loginScreen'),
  loginName: document.getElementById('loginName'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  loginNameField: document.getElementById('loginNameField'),
  loginEmailField: document.getElementById('loginEmailField'),
  loginPasswordField: document.getElementById('loginPasswordField'),
  togglePasswordBtn: document.getElementById('togglePasswordBtn'),
  rememberSession: document.getElementById('rememberSession'),
  recoverPasswordBtn: document.getElementById('recoverPasswordBtn'),
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
  scheduleTableBody: document.getElementById('scheduleTableBody')
};

document.title = cfg.APP_TITLE;

initAppwriteClient();
loadAppwriteServerConfig().finally(initSessionUI);
bindEvents();
initSchedule();
applyTheme(loadJSON('vs_theme_v1', 'dark'));
showLoading('Carregando biblioteca e organizando o ambiente...');
loadLibrary().then(() => { readDeepLinks(); routeInternalPage(); if (loadJSON(SESSION_KEY, null)?.name) maybeLaunchTour(); });

function setPlayButtonState(isPlaying){
  if (!el.playPauseBtn) return;
  el.playPauseBtn.setAttribute('aria-label', isPlaying ? 'Pausar' : 'Tocar');
  el.playPauseBtn.innerHTML = `<span class="player-icon ${isPlaying ? 'player-icon-pause' : 'player-icon-play'}" aria-hidden="true"></span>`;
}

function bindEvents(){
  window.addEventListener('hashchange', routeInternalPage);
  window.addEventListener('resize', () => { /* force details view on mobile */ applyViewMode(); render(); });
  el.search.addEventListener('input', onGlobalSearchInput);
  el.search.addEventListener('keydown', onGlobalSearchKeydown);
  el.viewThumbBtn.addEventListener('click', () => setViewMode('thumbnails'));
  el.viewDetailBtn.addEventListener('click', () => setViewMode('details'));
  el.musicFilter.addEventListener('change', render);
  el.keyFilter.addEventListener('change', render);
  el.tagFilter.addEventListener('change', render);
  el.typeFilter.addEventListener('change', render);
  el.refresh.addEventListener('click', () => loadLibrary(true));
  if (el.loadingSkipBtn) el.loadingSkipBtn.addEventListener('click', () => {
    hideLoading();
    toast('Acesso liberado. As músicas continuam carregando em segundo plano.');
  });
  el.themeToggle.addEventListener('click', toggleTheme);
  el.favoritesOnly.addEventListener('click', () => {
    isFavoritesFilter = !isFavoritesFilter;
    el.favoritesOnly.classList.toggle('favorites-active', isFavoritesFilter);
    render();
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
  el.copyLinkBtn.addEventListener('click', () => {
    const originalLabel = el.copyLinkBtn.textContent;
    copyText(location.origin + location.pathname, 'Link do sistema copiado.');
    el.copyLinkBtn.textContent = 'Link copiado!';
    el.copyLinkBtn.classList.add('is-success');
    setTimeout(() => {
      el.copyLinkBtn.textContent = originalLabel;
      el.copyLinkBtn.classList.remove('is-success');
    }, 1800);
  });

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
  el.volumeBar.addEventListener('input', () => el.audio.volume = Number(el.volumeBar.value) / 100);
  el.audio.volume = 1;
  el.audio.addEventListener('play', () => setPlayButtonState(true));
  el.audio.addEventListener('pause', () => setPlayButtonState(false));
  el.audio.addEventListener('timeupdate', syncProgressUI);
  el.audio.addEventListener('loadedmetadata', syncProgressUI);
  el.audio.addEventListener('ended', handleAudioEnded);

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
      const tone = selectedToneLabel || el.toneSelected?.textContent || '';
      closeToneModal();
      openSetlistModal(toneTarget, { semitones: selectedSemitone, tone });
    });
  }

  el.newSetlistBtn.addEventListener('click', () => openSetlistModal(null));
  el.closeSetlist.addEventListener('click', closeSetlistModal);
  el.setlistModal.addEventListener('click', e => { if (e.target === el.setlistModal) closeSetlistModal(); });
  el.createSetlistBtn.addEventListener('click', createSetlistFromInput);

  el.closeSetlistDetail.addEventListener('click', closeSetlistDetail);
  el.setlistDetailModal.addEventListener('click', e => { if (e.target === el.setlistDetailModal) closeSetlistDetail(); });
  el.playSetlistDetail.addEventListener('click', () => {
    const s = setlists.find(x => x.id === currentSetlistDetailId);
    if (!s) return;
    const tracks = mapSetlistTracks(s);
    if (tracks.length) playTrack(tracks[0], null, tracks);
  });
  el.shareSetlistDetail.addEventListener('click', () => {
    const s = setlists.find(x => x.id === currentSetlistDetailId);
    if (s) copyText(`${location.origin}${location.pathname}?setlist=${encodeURIComponent(s.id)}`, 'Link do repertório copiado.');
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

  if (el.enterSystemBtn) el.enterSystemBtn.addEventListener('click', enterSystem);
  if (el.createAccountBtn) el.createAccountBtn.addEventListener('click', createAccount);
  if (el.modeLoginBtn) el.modeLoginBtn.addEventListener('click', () => setAuthMode('login'));
  if (el.modeRegisterBtn) el.modeRegisterBtn.addEventListener('click', () => setAuthMode('register'));
  if (el.togglePasswordBtn) el.togglePasswordBtn.addEventListener('click', () => togglePasswordVisibility('loginPassword', 'togglePasswordBtn'));
  if (el.recoverPasswordBtn) el.recoverPasswordBtn.addEventListener('click', recoverPassword);
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
  if (hash === 'tutorialPage' || hash === 'tutorial' || hash === 'quickGuide') return 'tutorial';
  return 'home';
}

function routeInternalPage(){
  const page = getPageFromHash();
  const content = document.querySelector('.content');
  if (!content) return;

  content.classList.remove('page-mode-home','page-mode-library','page-mode-schedule','page-mode-setlists','page-mode-tutorial','page-mode-player-removed');
  content.classList.add(`page-mode-${page}`);

  const activeHashByPage = {
    home: '#inicio',
    library: '#biblioteca',
    schedule: '#escalaMensal',
    setlists: '#repertorios',
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
    setlists: document.querySelector('#repertorios'),
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
  } catch (error) {
    console.warn('Configuração Appwrite do servidor não carregada:', error);
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
  if (el.authModeHint) el.authModeHint.textContent = isRegister
    ? 'Crie sua conta informando nome, e-mail e senha.'
    : 'Entre com seu e-mail e senha para acessar sua conta.';
  if (el.loginNote) el.loginNote.textContent = isRegister
    ? 'Crie sua conta com nome, e-mail e senha. Após o cadastro, faça login para acessar sua conta de usuário. Usuários comuns não têm permissão para alterar a escala.'
    : 'Use seu e-mail e senha para entrar. Usuários comuns acessam a plataforma em modo de uso e não podem alterar a escala.';
  if (el.enterSystemBtn) el.enterSystemBtn.textContent = 'Entrar na conta';
  if (el.createAccountBtn) el.createAccountBtn.textContent = 'Criar cadastro';
  setAuthStatus('', false);
  ['loginName','loginEmail','loginPassword'].forEach(validateAuthField);
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
    if (value.length < 6) return setFieldState(el.loginPasswordField, 'invalid', 'A senha deve ter pelo menos 6 caracteres.'), false;
    setFieldState(el.loginPasswordField, 'valid', authMode === 'register' ? 'Senha válida para cadastro.' : 'Senha válida.');
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

async function initSessionUI(){
  if (!cloudReady || !appwriteAccount) {
    showLogin();
    setAuthStatus('Appwrite não configurado. Verifique endpoint e project ID.', true);
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
  el.loadingScreen?.classList.remove('hidden');
}
function hideLoading(){ el.loadingScreen?.classList.add('hidden'); }
function showLogin(){
  setAuthMode(authMode || 'login');
  el.loginScreen?.classList.remove('hidden');
  el.loginScreen?.setAttribute('aria-hidden', 'false');
  document.body.classList.add('app-locked');
  setTimeout(() => el.loginEmail?.focus(), 60);
}
function hideLogin(){
  el.loginScreen?.classList.add('hidden');
  el.loginScreen?.setAttribute('aria-hidden', 'true');
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
  await loadCloudState();
}
async function enterSystem(){
  const email = (el.loginEmail?.value || '').trim();
  const password = (el.loginPassword?.value || '').trim();
  if (!validateAuthForm('login')) return setAuthStatus('Revise os campos destacados para entrar.', true);
  if (!appwriteAccount) return setAuthStatus('Appwrite não inicializado.', true);
  try {
    setAuthStatus('Entrando...', false);
    await appwriteAccount.createEmailPasswordSession(email, password);
    const user = await appwriteAccount.get();
    await applyAuthUser(user);
    setAuthStatus('', false);
    if (libraryLoaded) maybeLaunchTour();
  } catch (error) {
    setAuthStatus(error?.message || 'Não foi possível entrar.', true);
  }
}
async function createAccount(){
  const name = (el.loginName?.value || '').trim();
  const email = (el.loginEmail?.value || '').trim();
  const password = (el.loginPassword?.value || '').trim();
  if (!validateAuthForm('register')) return setAuthStatus('Revise os campos destacados para concluir o cadastro.', true);
  if (!appwriteAccount || !window.Appwrite?.ID) return setAuthStatus('Appwrite não inicializado.', true);
  try {
    setAuthStatus('Criando cadastro no banco de dados...', false);
    await appwriteAccount.create(window.Appwrite.ID.unique(), email, password, name);
    if (el.loginPassword) el.loginPassword.value = '';
    setAuthMode('login');
    validateAuthField('loginEmail');
    validateAuthField('loginPassword');
    setAuthStatus('Cadastro criado com sucesso. Agora informe sua senha e clique em “Entrar na conta”.', false);
    toast('Cadastro criado. Faça login para acessar sua conta.');
    setTimeout(() => el.loginPassword?.focus(), 80);
  } catch (error) {
    setAuthStatus(error?.message || 'Não foi possível criar o cadastro.', true);
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
  if (!appwriteAccount) return setAuthStatus('Appwrite não inicializado.', true);
  try {
    setAuthStatus('Enviando instruções de recuperação...', false);
    const recoveryUrl = `${location.origin}${location.pathname}`;
    await appwriteAccount.createRecovery(email, recoveryUrl);
    setAuthStatus('Enviamos as instruções de recuperação para o e-mail informado.', false);
  } catch (error) {
    setAuthStatus(error?.message || 'Não foi possível iniciar a recuperação de senha.', true);
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
    const [shared, userState, cloudMembers, cloudSchedule] = await Promise.all([
      getSharedState('setlists'),
      getUserState('favorites'),
      getSharedState('members'),
      getSharedState('monthlySchedule')
    ]);
    if (Array.isArray(shared)) setlists = shared;
    if (Array.isArray(userState)) favorites = userState;
    if (Array.isArray(cloudMembers) && cloudMembers.length) members = normalizeMembers(cloudMembers);
    if (Array.isArray(cloudSchedule) && cloudSchedule.length) scheduleRows = normalizeScheduleRows(cloudSchedule);
    saveJSON('vs_setlists_v1', setlists);
    saveJSON('vs_favorites_v1', favorites);
    saveJSON('vs_members_v1', members);
    saveJSON('vs_schedule_rows_v1', scheduleRows);
    await seedScheduleDataIfNeeded(cloudMembers, cloudSchedule);
    updateStats();
    updateFavoriteCount();
    populateScheduleFilters();
    renderSchedule();
    renderSetlists();
    render();
  } catch (error) {
    console.warn('Estado online não carregado:', error);
    toast('Não foi possível sincronizar com Appwrite. Usando dados locais.');
  }
}
async function getSharedState(key){
  const res = await fetch(`/api/appwrite/state/${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.value;
}
async function setSharedState(key, value){
  if (!authUser) return;
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
function canDeleteSetlists(){
  return isScheduleAdmin();
}
function canEditSetlists(){
  return Boolean(authUser);
}
async function setAdminSharedState(key, value){
  if (!authUser) throw new Error('Faça login para salvar.');
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
    bass: row.bass || '', drums: row.drums || '', guitar: row.guitar || '', keyboard: row.keyboard || '', sound: row.sound || ''
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
    toast('Membros e escala inicial sincronizados no Appwrite.');
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
    setScheduleEditStatus('Salvando escala no Appwrite...', 'saving');
    await Promise.all([
      setAdminSharedState('members', members),
      setAdminSharedState('monthlySchedule', scheduleRows)
    ]);
    scheduleDirty = false;
    saveJSON('vs_members_v1', members);
    saveJSON('vs_schedule_rows_v1', scheduleRows);
    setScheduleEditStatus('Escala salva no banco de dados Appwrite.', 'admin');
    if (showToast) toast('Escala salva com sucesso.');
  } catch (error) {
    console.error(error);
    setScheduleEditStatus(`Erro ao salvar: ${error.message}`, 'error');
    toast('Não foi possível salvar a escala no Appwrite.');
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
function saveSetlistsState(){
  saveJSON('vs_setlists_v1', setlists);
  setSharedState('setlists', setlists).catch(err => console.warn('Repertórios não sincronizados:', err));
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
  const localSchedule = loadJSON('vs_schedule_rows_v1', null);
  if (Array.isArray(localMembers)) members = normalizeMembers(localMembers);
  if (Array.isArray(localSchedule)) scheduleRows = normalizeScheduleRows(localSchedule);
  populateScheduleFilters();
  renderSchedule();
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
  if (!authUser) setScheduleEditStatus('Faça login para visualizar a escala. A edição é restrita aos administradores.', '');
  else if (admin) setScheduleEditStatus(scheduleDirty ? 'Alteração pendente. Clique em “Salvar escala” para gravar no banco de dados.' : 'Modo edição liberado. Use as listas suspensas para alterar os escalados.', 'admin');
  else if (!cloudAdminConfigured) setScheduleEditStatus('Escala em modo leitura. Configure APPWRITE_ADMIN_EMAILS no Render para liberar administradores.', '');
  else setScheduleEditStatus('Escala em modo leitura. Sua conta é de usuário comum e não pode alterar os escalados.', '');
}
function renderSchedule(){
  if (!el.scheduleTableBody) return;
  updateScheduleEditUI();
  const rows = getFilteredScheduleRows();
  const q = normalize(el.scheduleSearch?.value || '');
  if (!rows.length) {
    el.scheduleTableBody.innerHTML = '<tr><td colspan="10" class="schedule-empty">Nenhum resultado encontrado na escala.</td></tr>';
    if (el.scheduleCards) el.scheduleCards.innerHTML = '<div class="schedule-mobile-empty">Nenhum resultado encontrado na escala.</div>';
  } else {
    el.scheduleTableBody.innerHTML = rows.map(row => renderScheduleRow(row, q)).join('');
    renderScheduleCards(rows, q);
  }
  renderScheduleSummary(rows);
}
function renderScheduleCards(rows, q){
  if (!el.scheduleCards) return;
  const fields = ['minister','back1','back2','back3','bass','drums','guitar','keyboard','sound'];
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
  const fields = ['minister','back1','back2','back3','bass','drums','guitar','keyboard','sound'];
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
  setScheduleEditStatus('Alteração pendente. Clique em “Salvar escala” para gravar no banco de dados.', 'admin');
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
  rows.forEach(row => ['minister','back1','back2','back3','bass','drums','guitar','keyboard','sound'].forEach(field => { if (row[field]) people.add(row[field]); }));
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
function transposeUrl(id, semitones){ return !semitones ? driveUrl(id) : `/api/transpose/${encodeURIComponent(id)}?semitones=${encodeURIComponent(semitones)}`; }
function downloadUrl(id, name, semitones = 0){
  const filename = encodeURIComponent(`${safeFileName(name)}${semitones ? `_tom_${semitones > 0 ? '+' : ''}${semitones}` : ''}.mp3`);
  if (semitones) return `/api/transpose/${encodeURIComponent(id)}?semitones=${encodeURIComponent(semitones)}&download=1&filename=${filename}`;
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
function esc(str){ return String(str).replace(/[&<>'"]/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[ch])); }

function detectKey(text){
  const s = String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const m = s.match(/(?:^|[\s_\-\(\[])((?:A|B|C|D|E|F|G)(?:#|b)?m?)(?:$|[\s_\-\)\]])/i);
  return m ? m[1].toUpperCase().replace('M','m') : '—';
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
        toast('Biblioteca liberada. Continuamos indexando o restante em segundo plano.');
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
    const freshTracks = [];
    await loadFolderProgressive(cfg.ROOT_FOLDER_ID, '', '', freshTracks, false);
    freshTracks.sort((a,b) => a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'}));
    if (freshTracks.length) {
      allTracks = freshTracks;
      saveJSON('vs_drive_cache_v10', { updatedAt: Date.now(), tracks: allTracks });
      afterLibraryLoaded();
      el.status.textContent = 'Biblioteca sincronizada em segundo plano.';
    }
  } catch (error) {
    console.warn('Atualização em segundo plano falhou:', error);
  } finally {
    libraryLoadingInBackground = false;
  }
}

async function loadLibrary(force = false){
  try {
    showLoading(force ? 'Atualizando biblioteca do Google Drive...' : 'Liberando acesso e preparando a biblioteca...');
    resetProgressCounters();
    el.status.textContent = 'Preparando biblioteca...';

    const cacheKey = 'vs_drive_cache_v10';
    if (!force) {
      const cached = loadJSON(cacheKey, null);
      if (cached && Array.isArray(cached.tracks) && cached.tracks.length) {
        allTracks = cached.tracks;
        afterLibraryLoaded();
        el.status.textContent = 'Biblioteca carregada do cache. Atualizando em segundo plano...';
        hideLoading();
        refreshLibraryInBackground();
        return;
      }
    }

    allTracks = [];
    afterLibraryLoaded();
    el.status.textContent = 'Biblioteca sendo indexada em segundo plano...';

    setTimeout(() => {
      if (!firstProgressBatchReleased) {
        hideLoading();
        toast('Acesso liberado. As músicas aparecerão conforme forem indexadas.');
      }
    }, 1400);

    await loadFolderProgressive(cfg.ROOT_FOLDER_ID, '', '', allTracks, true);
    allTracks.sort((a,b) => a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'}));
    saveJSON(cacheKey, { updatedAt: Date.now(), tracks: allTracks });
    afterLibraryLoaded();
    completeLoadingProgress();
    el.status.textContent = 'Biblioteca carregada';
    hideLoading();
  } catch (error) {
    console.error(error);
    hideLoading();
    el.status.textContent = 'Não foi possível carregar os filtros da biblioteca';
    el.trackList.innerHTML = `<div class="empty">${esc(error.message || 'Erro ao carregar')}</div>`;
  }
}

function afterLibraryLoaded(){
  libraryLoaded = true;
  populateFilters();
  updateStats();
  renderSetlists();
  render();
  if (el.status) {
    el.status.textContent = allTracks.length
      ? `Filtros prontos • ${allTracks.length} música(s) disponíveis`
      : 'Filtros prontos • aguardando músicas da biblioteca';
  }
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
  const keys = unique(allTracks.map(t => t.key));
  const tags = unique(allTracks.flatMap(t => t.tags || []));
  el.totalTracks.textContent = allTracks.length;
  el.totalSingers.textContent = folders.length;
  el.totalSingersInline.textContent = folders.length;
  el.totalKeys.textContent = keys.length;
  el.totalFavorites.textContent = favorites.length;
  el.heroTotal.textContent = allTracks.length;
  el.heroTotalPanel.textContent = allTracks.length;
  el.heroSetlists.textContent = setlists.length;
  el.heroFavs.textContent = favorites.length;
  el.heroKeys.textContent = keys.length;
  el.heroCategories.textContent = tags.length;
  updateProfileModal();
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
  return allTracks.filter(t => {
    if (isFavoritesFilter && !favorites.includes(t.id)) return false;
    if (el.musicFilter.value && t.name !== el.musicFilter.value) return false;
    if (el.keyFilter.value && t.key !== el.keyFilter.value) return false;
    if (el.tagFilter.value && !(t.tags || []).includes(el.tagFilter.value)) return false;
    if (el.typeFilter.value && t.ext.toUpperCase() !== el.typeFilter.value) return false;
    if (!q) return true;
    const blob = normalize(`${t.name} ${t.singer} ${t.fileName} ${(t.tags||[]).join(' ')} ${t.key}`);
    return blob.includes(q);
  });
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

  filteredTracksCache = getFiltered();
  renderedCount = 0;

  el.resultCount.textContent = `${filteredTracksCache.length} resultado(s)`;

  if (!filteredTracksCache.length) {
    const loadingMsg = indexedTrackCount === 0 && (libraryLoadingInBackground || discoveredFolderCount > indexedFolderCount)
      ? 'A biblioteca ainda está sendo indexada. As músicas aparecerão automaticamente conforme forem encontradas.'
      : 'Nenhuma música encontrada com os filtros atuais.';
    el.trackList.innerHTML = `<div class="empty">${loadingMsg}</div>`;
    el.loadStatus.textContent = indexedTrackCount === 0 ? 'Indexando músicas...' : 'Nenhuma música para carregar';
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
  return `
    <article class="track-card" data-id="${esc(t.id)}">
      <div class="track-head">
        <div class="track-cover logo-cover" ${coverStyle}></div>
        <div class="track-main">
          <div class="track-title">${esc(t.name)}</div>
          <div class="track-sub"><span>${esc(t.singer)}</span><span>•</span><span>${esc(t.fileName)}</span></div>
        </div>
      </div>
      <div class="track-meta">
        <span class="meta key">Tom ${esc(t.key || '—')}</span>
        <span class="meta">${esc(t.ext.toUpperCase())}</span>
      </div>
      <div class="tag-wrap">${(t.tags || []).map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</div>
      <div class="track-actions">
        <button class="action-btn primary play-btn" data-id="${esc(t.id)}">▶ Tocar</button>
        <button class="action-icon fav-btn ${fav ? 'is-fav' : ''}" data-id="${esc(t.id)}" title="Favoritar" aria-label="Favoritar"><span class="action-icon-glyph">${fav ? '♥' : '♡'}</span><span class="action-icon-label">Favoritar</span></button>
        <button class="action-icon tone-btn-open" data-id="${esc(t.id)}" title="Alterar tom" aria-label="Alterar tom"><span class="action-icon-glyph">♬</span><span class="action-icon-label">Tom</span></button>
        <button class="action-icon setlist-btn" data-id="${esc(t.id)}" title="Adicionar ao repertório" aria-label="Adicionar ao repertório"><span class="action-icon-glyph">+☷</span><span class="action-icon-label">Repertório</span></button>
        <button class="action-icon detail-btn" data-id="${esc(t.id)}" title="Ver detalhes" aria-label="Ver detalhes"><span class="action-icon-glyph">⋯</span><span class="action-icon-label">Detalhes</span></button>
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
    btn.addEventListener('click', () => openSetlistModal(findTrack(btn.dataset.id)));
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

function playTrack(track, semitones = null, queue = currentQueue, options = {}){
  if (!track) return;
  randomContinuousMode = Boolean(options.randomContinuous);
  document.body.classList.add('player-visible');
  document.getElementById('playerArea')?.classList.remove('player-hidden');
  if (semitones === null || semitones === undefined) semitones = Number(track.repertoireSemitones || 0);
  current = track;
  currentQueue = queue && queue.length ? queue : getFiltered();
  currentIndex = currentQueue.findIndex(t => t.id === track.id);
  const src = semitones ? transposeUrl(track.id, semitones) : driveUrl(track.id);
  el.audio.src = src;
  el.audio.load();
  const p = el.audio.play();
  if (p && typeof p.catch === 'function') p.catch(err => console.warn('Falha ao tocar automaticamente:', err));
  const alteredToneLabel = track.repertoireTone || (semitones ? calculateToneLabel(track.key, semitones) : '');
  el.nowTitle.textContent = alteredToneLabel ? `${track.name} • Tom alterado ${alteredToneLabel}` : track.name;
  el.nowSinger.textContent = `${track.singer}${track.key && track.key !== '—' ? ' • Tom original ' + track.key : ''}${alteredToneLabel ? ' • Tom alterado ' + alteredToneLabel : ''}`;
  el.nowCover.src = track.coverUrl || 'assets/logo-avida.jpg';
  syncProgressUI();
}

function closePlayer(){
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
  const pct = duration ? (currentTime / duration) * 100 : 0;
  el.progressBar.value = pct;
  el.progressFill.style.width = `${pct}%`;
  el.currentTime.textContent = formatTime(currentTime);
  el.durationTime.textContent = formatTime(duration);
}
function onSeek(){
  const duration = Number.isFinite(el.audio.duration) ? el.audio.duration : 0;
  if (!duration) return;
  el.audio.currentTime = (Number(el.progressBar.value) / 100) * duration;
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
  el.toneCurrent.textContent = parsed.base ? `${originalBase}${suffix}` : 'Não detectado';
  if (el.toneSelected) el.toneSelected.textContent = parsed.base ? `${originalBase}${suffix}` : 'Escolha o tom';

  const helper = parsed.base
    ? '<div class="tone-help">Escolha o novo tom desejado. O sistema calcula automaticamente a transposição.</div>'
    : '<div class="tone-help">Tom original não detectado. Para maior precisão, inclua o tom no nome do arquivo, exemplo: “Nome da Música - D.mp3”.</div>';

  el.toneButtons.innerHTML = helper + CHROMATIC_KEYS.map(key => {
    const semitone = calculateShortestShift(originalIndex >= 0 ? originalIndex : 0, CHROMATIC_KEYS.indexOf(key));
    const label = `${key}${suffix}`;
    const isOriginal = parsed.base && key === originalBase;
    return `
      <button class="tone-btn ${isOriginal ? 'active original' : ''}" data-key="${key}" data-step="${semitone}">
        ${label}
        <small>${semitone === 0 ? 'original' : `${semitone > 0 ? '+' : ''}${semitone}`}</small>
      </button>
    `;
  }).join('');

  el.toneButtons.querySelectorAll('.tone-btn').forEach(btn => btn.addEventListener('click', () => {
    selectedSemitone = Number(btn.dataset.step);
    selectedToneLabel = `${btn.dataset.key}${suffix}`;

    el.toneButtons.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (el.toneSelected) el.toneSelected.textContent = selectedToneLabel;
    el.downloadToneBtn.href = downloadUrl(track.id, track.name, selectedSemitone);
    el.playToneBtn.textContent = selectedSemitone === 0 ? '▶ Ouvir no tom original' : `▶ Ouvir em ${selectedToneLabel}`;
    el.downloadToneBtn.textContent = selectedSemitone === 0 ? 'Baixar tom original' : `Baixar em ${selectedToneLabel}`;
    if (el.addToneToSetlistBtn) el.addToneToSetlistBtn.textContent = selectedSemitone === 0 ? '+ Adicionar ao repertório' : `+ Adicionar ao repertório em ${selectedToneLabel}`;
  }));

  el.downloadToneBtn.href = downloadUrl(track.id, track.name, 0);
  el.playToneBtn.textContent = '▶ Ouvir no tom original';
  el.downloadToneBtn.textContent = 'Baixar tom original';
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
  el.totalFavorites.textContent = favorites.length;
  el.heroFavs.textContent = favorites.length;
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
function createSetlistFromInput(){
  if (!canEditSetlists()) {
    toast('Faça login para criar repertórios.');
    return;
  }
  const name = el.newSetlistName.value.trim();
  if (!name) return;
  const s = { id: String(Date.now()), name, trackIds: setlistTarget ? [makeSetlistEntry(setlistTarget, setlistTargetTone)] : [] };
  setlists.push(s);
  saveSetlistsState();
  updateStats();
  renderSetlists();
  renderSetlistOptions();
  el.newSetlistName.value = '';
  toast('Repertório criado.');
}
function renderSetlistOptions(){
  if (!setlists.length) {
    el.setlistOptions.innerHTML = '<div class="empty">Nenhum repertório criado ainda.</div>';
    return;
  }
  el.setlistOptions.innerHTML = setlists.map(s => `
    <div class="stack-item">
      <div><strong>${esc(s.name)}</strong><span>${s.trackIds.length} música(s)</span></div>
      <button class="mini-btn add-to-setlist" data-id="${esc(s.id)}">Adicionar</button>
    </div>
  `).join('');
  el.setlistOptions.querySelectorAll('.add-to-setlist').forEach(btn => btn.addEventListener('click', () => {
    if (!canEditSetlists()) {
      toast('Faça login para alterar repertórios.');
      return;
    }
    const setlist = setlists.find(s => s.id === btn.dataset.id);
    if (!setlist || !setlistTarget) return;
    const entry = makeSetlistEntry(setlistTarget, setlistTargetTone);
    if (!setlistHasEntry(setlist, entry)) setlist.trackIds.push(entry);
    saveSetlistsState();
    updateStats();
    renderSetlists();
    closeSetlistModal();
    toast('Música adicionada ao repertório.');
  }));
}

function renderSetlists(){
  const permissionNotice = authUser
    ? (canDeleteSetlists() ? 'Modo líder: você pode criar, editar e excluir repertórios.' : 'Usuário comum: você pode criar e editar repertórios; excluir é restrito aos líderes.')
    : 'Faça login para criar ou editar repertórios.';
  if (!setlists.length) {
    el.setlistsGrid.innerHTML = `<div class="empty">Nenhum repertório criado ainda. ${permissionNotice}</div>`;
    return;
  }
  el.setlistsGrid.innerHTML = `<div class="setlist-permission-note">${permissionNotice}</div>` + setlists.map(s => `
    <article class="setlist-card">
      <strong>${esc(s.name)}</strong>
      <div class="muted">${s.trackIds.length} música(s)</div>
      <div class="setlist-actions">
        <button class="mini-btn play-setlist" data-id="${esc(s.id)}">Tocar</button>
        <button class="mini-btn open-setlist" data-id="${esc(s.id)}">Abrir</button>
        <button class="mini-btn share-setlist" data-id="${esc(s.id)}">Compartilhar</button>
        ${canDeleteSetlists() ? `<button class="mini-btn delete-setlist" data-id="${esc(s.id)}">Excluir</button>` : ''}
      </div>
    </article>
  `).join('');

  el.setlistsGrid.querySelectorAll('.play-setlist').forEach(btn => btn.addEventListener('click', () => playSetlistById(btn.dataset.id)));
  el.setlistsGrid.querySelectorAll('.open-setlist').forEach(btn => btn.addEventListener('click', () => openSetlistDetail(btn.dataset.id)));
  el.setlistsGrid.querySelectorAll('.share-setlist').forEach(btn => btn.addEventListener('click', () => {
    copyText(`${location.origin}${location.pathname}?setlist=${encodeURIComponent(btn.dataset.id)}`, 'Link do repertório copiado.');
  }));
  el.setlistsGrid.querySelectorAll('.delete-setlist').forEach(btn => btn.addEventListener('click', () => {
    if (!canDeleteSetlists()) {
      toast('Somente administradores podem excluir repertórios.');
      return;
    }
    if (!confirm('Excluir este repertório?')) return;
    setlists = setlists.filter(s => s.id !== btn.dataset.id);
    saveSetlistsState();
    updateStats();
    renderSetlists();
  }));
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

function openSetlistDetail(id){
  currentSetlistDetailId = id;
  const setlist = setlists.find(s => s.id === id);
  if (!setlist) return;
  el.setlistDetailTitle.textContent = setlist.name;
  renderSetlistDetailTracks();
  el.setlistDetailModal.classList.remove('hidden');
}
function closeSetlistDetail(){ el.setlistDetailModal.classList.add('hidden'); }
function renderSetlistDetailTracks(){
  const setlist = setlists.find(s => s.id === currentSetlistDetailId);
  if (!setlist) return;
  const tracks = mapSetlistTracks(setlist);
  if (!tracks.length) {
    el.setlistDetailTracks.innerHTML = '<div class="empty">Este repertório ainda não possui músicas.</div>';
    return;
  }
  el.setlistDetailTracks.innerHTML = tracks.map((track, index) => `
    <div class="reorder-item" draggable="true" data-id="${esc(track.id)}" data-index="${index}">
      <div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1">
        <span class="drag-handle">⋮⋮</span>
        <div>
          <strong>${index + 1}. ${esc(track.name)}</strong>
          <span>${esc(track.singer)} • Tom original ${esc(track.key || '—')} ${track.repertoireTone ? ` • <span class="repertoire-tone-badge">Tom alterado: ${esc(track.repertoireTone)}</span>` : ''}</span>
        </div>
      </div>
      <div class="row-actions">
        <button class="mini-btn move-up" data-index="${index}" aria-label="Mover para cima">↑</button>
        <button class="mini-btn move-down" data-index="${index}" aria-label="Mover para baixo">↓</button>
        <button class="mini-btn play-one" data-id="${esc(track.id)}">Tocar</button>
        <button class="mini-btn remove-one" data-id="${esc(track.id)}">Remover</button>
      </div>
    </div>
  `).join('');
  bindReorderEvents();
  el.setlistDetailTracks.querySelectorAll('.play-one').forEach(btn => btn.addEventListener('click', () => {
    const idx = Number(btn.closest('.reorder-item')?.dataset.index || 0);
    const track = tracks[idx];
    if (track) playTrack(track, null, tracks);
  }));
  el.setlistDetailTracks.querySelectorAll('.remove-one').forEach(btn => btn.addEventListener('click', () => {
    const idx = Number(btn.closest('.reorder-item')?.dataset.index);
    if (Number.isInteger(idx) && idx >= 0) setlist.trackIds.splice(idx, 1);
    saveSetlistsState();
    renderSetlists();
    renderSetlistDetailTracks();
    updateStats();
  }));
  el.setlistDetailTracks.querySelectorAll('.move-up').forEach(btn => btn.addEventListener('click', () => {
    const idx = Number(btn.dataset.index);
    if (!Number.isInteger(idx) || idx <= 0) return;
    reorderSetlist(currentSetlistDetailId, idx, idx - 1);
    renderSetlistDetailTracks();
    renderSetlists();
  }));
  el.setlistDetailTracks.querySelectorAll('.move-down').forEach(btn => btn.addEventListener('click', () => {
    const idx = Number(btn.dataset.index);
    if (!Number.isInteger(idx) || idx >= (setlist.trackIds.length - 1)) return;
    reorderSetlist(currentSetlistDetailId, idx, idx + 1);
    renderSetlistDetailTracks();
    renderSetlists();
  }));
}
function bindReorderEvents(){
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
  el.songModalSubtitle.textContent = `${track.singer} • ${track.fileName}`;
  const alteredTone = track.repertoireTone || '';
  el.songModalMeta.innerHTML = `
    <span class="meta key">Tom original: ${esc(track.key || '—')}</span>
    <span class="meta altered-tone">Tom alterado: ${alteredTone ? esc(alteredTone) : '—'}</span>
    <span class="meta">Arquivo: ${esc(track.ext.toUpperCase())}</span>
    <span class="meta">Origem: Google Drive</span>
  `;
  el.songModalTags.innerHTML = (track.tags || []).map(tag => `<span class="tag">${esc(tag)}</span>`).join('');
  el.songModalFavorite.textContent = favorites.includes(track.id) ? '♥ Favorita' : '♡ Favoritar';
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
      el.search.value = track.name;
      render();
      setTimeout(() => playTrack(track, 0, [track]), 200);
    }
  }
  if (setlistId) {
    const setlist = setlists.find(s => s.id === setlistId);
    if (setlist) {
      const tracks = mapSetlistTracks(setlist);
      if (tracks.length) setTimeout(() => playTrack(tracks[0], 0, tracks), 250);
      setTimeout(() => openSetlistDetail(setlist.id), 350);
    }
  }
}

function copyText(text, message){
  navigator.clipboard.writeText(text).then(() => toast(message)).catch(() => alert(text));
}
function toast(message){
  document.querySelector('.toast')?.remove();
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 1800);
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
