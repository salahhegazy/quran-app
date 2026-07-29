/**
 * QURAN APP - Full Offline Ad-Free Mushaf Engine
 * Using QCF4 Font Database & Page JSON rendering
 */

class QuranApp {
  constructor() {
    this.currentPage = parseInt(localStorage.getItem('quran_last_page') || '1', 10);
    this.indexData = null;
    this.versesIndex = null;
    this.fontMapData = null;
    this.loadedFonts = new Set();
    
    // Audio Player State
    this.audioElement = new Audio();
    this.currentReciter = localStorage.getItem('quran_reciter') || 'ar.alafasy';
    this.currentAudioAyah = null; // { surah, verse, verseKey }
    this.isPlaying = false;

    // Selected Verse State
    this.selectedVerseKey = null;
    this.selectedWordElement = null;

    // Bookmarks
    this.bookmarks = JSON.parse(localStorage.getItem('quran_bookmarks') || '[]');

    this.init();
  }

  async init() {
    try {
      this.bindDOM();
      this.setupEventListeners();
      this.loadTheme();
      
      // Load Master Metadata
      const [indexRes, fontMapRes] = await Promise.all([
        fetch('/index.json'),
        fetch('/font-map.json')
      ]);

      this.indexData = await indexRes.json();
      this.fontMapData = await fontMapRes.json();

      // Render initial page
      await this.loadAndRenderPage(this.currentPage);

      // Lazy load verses index in background for search
      fetch('/verses.json').then(r => r.json()).then(data => {
        this.versesIndex = data;
      });

    } catch (err) {
      console.error("Failed to initialize Quran App:", err);
    }
  }

  bindDOM() {
    this.elements = {
      headerTitle: document.getElementById('header-title'),
      headerSubtitle: document.getElementById('header-subtitle'),
      mushafPage: document.getElementById('mushaf-page'),
      btnPrevPage: document.getElementById('btn-prev-page'),
      btnNextPage: document.getElementById('btn-next-page'),
      pageSlider: document.getElementById('page-slider'),
      btnFirstPage: document.getElementById('btn-first-page'),
      btnLastPage: document.getElementById('btn-last-page'),
      directPageInput: document.getElementById('direct-page-input'),
      btnDirectJump: document.getElementById('btn-direct-jump'),
      
      // Modals
      btnMenuSurah: document.getElementById('btn-menu-surah'),
      btnMenuJuz: document.getElementById('btn-menu-juz'),
      btnSearch: document.getElementById('btn-search'),
      btnBookmarks: document.getElementById('btn-bookmarks'),
      btnSettings: document.getElementById('btn-settings'),
      
      modalSurah: document.getElementById('modal-surah'),
      modalJuz: document.getElementById('modal-juz'),
      modalBookmarks: document.getElementById('modal-bookmarks'),
      modalSearch: document.getElementById('modal-search'),
      modalVerseAction: document.getElementById('modal-verse-action'),
      modalSettings: document.getElementById('modal-settings'),
      
      surahListContainer: document.getElementById('surah-list-container'),
      juzListContainer: document.getElementById('juz-list-container'),
      surahFilterInput: document.getElementById('surah-filter-input'),
      bookmarksList: document.getElementById('bookmarks-list'),
      btnSaveCurrentBookmark: document.getElementById('btn-save-current-bookmark'),
      lblCurrPageBm: document.getElementById('lbl-curr-page-bm'),
      
      // Audio
      audioBar: document.getElementById('audio-bar'),
      audioAyahTitle: document.getElementById('audio-ayah-title'),
      audioReciterSelect: document.getElementById('audio-reciter-select'),
      btnAudioPrev: document.getElementById('btn-audio-prev'),
      btnAudioPlay: document.getElementById('btn-audio-play'),
      btnAudioNext: document.getElementById('btn-audio-next'),
      btnAudioClose: document.getElementById('btn-audio-close'),
      iconPlay: document.getElementById('icon-play'),
      iconPause: document.getElementById('icon-pause'),

      // Search
      quranSearchInput: document.getElementById('quran-search-input'),
      btnDoSearch: document.getElementById('btn-do-search'),
      searchResultsList: document.getElementById('search-results-list'),
      searchResultsStats: document.getElementById('search-results-stats'),

      // Verse Action Sheet
      verseActionTitle: document.getElementById('verse-action-title'),
      versePreviewText: document.getElementById('verse-preview-text'),
      actPlayVerse: document.getElementById('act-play-verse'),
      actTafsirVerse: document.getElementById('act-tafsir-verse'),
      actCopyVerse: document.getElementById('act-copy-verse'),
      actBookmarkVerse: document.getElementById('act-bookmark-verse'),
      tafsirContainer: document.getElementById('tafsir-container'),
      tafsirTextContent: document.getElementById('tafsir-text-content'),
    };
  }

  setupEventListeners() {
    // Navigation (Optional arrow button check)
    if (this.elements.btnNextPage) this.elements.btnNextPage.addEventListener('click', () => this.nextPage());
    if (this.elements.btnPrevPage) this.elements.btnPrevPage.addEventListener('click', () => this.prevPage());
    
    this.elements.pageSlider.addEventListener('input', (e) => {
      const page = parseInt(e.target.value, 10);
      this.loadAndRenderPage(page);
    });

    this.elements.btnFirstPage.addEventListener('click', () => this.loadAndRenderPage(1));
    this.elements.btnLastPage.addEventListener('click', () => this.loadAndRenderPage(604));

    this.elements.btnDirectJump.addEventListener('click', () => {
      const p = parseInt(this.elements.directPageInput.value, 10);
      if (p >= 1 && p <= 604) this.loadAndRenderPage(p);
    });

    // Keyboard Arrow Keys (Right Arrow = Next Page)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') this.nextPage();
      if (e.key === 'ArrowLeft') this.prevPage();
    });

    // Touch Swipe Navigation & Tap Fullscreen Toggle
    let touchStartX = 0;
    let touchMoved = false;
    const mushafEl = this.elements.mushafPage;
    mushafEl.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchMoved = false;
    }, { passive: true });

    mushafEl.addEventListener('touchmove', () => {
      touchMoved = true;
    }, { passive: true });
    
    mushafEl.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (diff < -50) this.nextPage();
      else if (diff > 50) this.prevPage();
    }, { passive: true });

    mushafEl.addEventListener('click', (e) => {
      if (e.target.closest('.quran-word') || e.target.closest('.icon-btn')) return;
      if (!touchMoved) {
        document.body.classList.toggle('fullscreen-mode');
      }
    });

    // Modals Triggers
    this.elements.btnMenuSurah.addEventListener('click', () => this.openSurahIndex());
    this.elements.btnMenuJuz.addEventListener('click', () => this.openJuzIndex());
    this.elements.btnBookmarks.addEventListener('click', () => this.openBookmarks());
    this.elements.btnSearch.addEventListener('click', () => this.openModal(this.elements.modalSearch));
    this.elements.btnSettings.addEventListener('click', () => this.openModal(this.elements.modalSettings));

    // Close Modals
    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
      el.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) this.closeModal(modal);
      });
    });

    // Surah Filter
    this.elements.surahFilterInput.addEventListener('input', (e) => {
      this.filterSurahs(e.target.value);
    });

    // Search Execution
    this.elements.btnDoSearch.addEventListener('click', () => this.executeSearch());
    this.elements.quranSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.executeSearch();
    });

    // Bookmarks
    this.elements.btnSaveCurrentBookmark.addEventListener('click', () => {
      this.addBookmark(this.currentPage, `صفحة ${this.currentPage}`);
      this.renderBookmarksList();
    });

    // Themes Selection
    document.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        const theme = card.dataset.theme;
        this.setTheme(theme);
      });
    });

    // Audio Reciter Selection
    this.elements.audioReciterSelect.addEventListener('change', (e) => {
      this.currentReciter = e.target.value;
      localStorage.setItem('quran_reciter', this.currentReciter);
      if (this.currentAudioAyah) {
        this.playAyahAudio(this.currentAudioAyah.verseKey);
      }
    });

    this.elements.btnAudioPlay.addEventListener('click', () => this.toggleAudioPlay());
    this.elements.btnAudioClose.addEventListener('click', () => this.closeAudioBar());
    this.elements.btnAudioNext.addEventListener('click', () => this.playNextAyah());
    this.elements.btnAudioPrev.addEventListener('click', () => this.playPrevAyah());

    // Audio Ended Listener
    this.audioElement.addEventListener('ended', () => {
      this.playNextAyah();
    });

    // Verse Actions Modal Listeners
    this.elements.actPlayVerse.addEventListener('click', () => {
      if (this.selectedVerseKey) {
        this.playAyahAudio(this.selectedVerseKey);
        this.closeModal(this.elements.modalVerseAction);
      }
    });

    this.elements.actCopyVerse.addEventListener('click', () => {
      if (this.selectedVerseKey && this.versesIndex && this.versesIndex[this.selectedVerseKey]) {
        const text = this.versesIndex[this.selectedVerseKey].text || this.selectedVerseKey;
        navigator.clipboard.writeText(text);
        alert('تم نسخ الآية بنجاح');
      }
    });

    this.elements.actTafsirVerse.addEventListener('click', () => {
      this.loadTafsir(this.selectedVerseKey);
    });

    this.elements.actBookmarkVerse.addEventListener('click', () => {
      if (this.selectedVerseKey) {
        this.addBookmark(this.currentPage, `آية (${this.selectedVerseKey}) - صفحة ${this.currentPage}`);
        alert('تم حفظ العلامة بنجاح');
      }
    });

    // Tafsir Tab Buttons
    document.querySelectorAll('.tafsir-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tafsir-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.renderTafsirTab(e.target.dataset.tab);
      });
    });
  }

  // --- Divine Name Detector (Allah, Rabb, Rabbana) ---
  isDivineNameWord(text) {
    if (!text) return false;
    // Strip all Arabic diacritics & Quranic marks
    const clean = text.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0671]/g, '').trim();

    // Lafz Al-Jalalah variations (Allah, Lillah, Tallah, Wallah, Fallah, Billah, etc.)
    if (/^(الله|لله|تالله|والله|فالله|بالله|ولله|فلله|اللهم|فاللهم|وللهم)$/.test(clean)) {
      return true;
    }

    // Rabb / Rabbana / Rabbik / Rabbih / Rabbikum variations
    if (/^(رب|ربي|ربنا|ربك|ربكم|ربه|ربها|ربهم|ربكما|ربهما|الرب|فربك|فربكم|فربه|فربهم|فربنا|بربك|بربكم|بربه|بربهم|بربنا|وربك|وربكم|وربه|وربهم|وربنا)$/.test(clean)) {
      return true;
    }

    return false;
  }

  // --- Dynamic Font Loader ---
  async ensureFontLoaded(fontName) {
    if (!fontName || this.loadedFonts.has(fontName)) return;

    // QCF4_QBSML has no _W suffix; all Hafs fonts have _W suffix e.g., QCF4_Hafs_01_W.woff2
    const fileName = fontName === "QCF4_QBSML" ? fontName : `${fontName}_W`;
    const fontUrl = `/fonts-woff2/${fileName}.woff2`;
    const fontFace = new FontFace(fontName, `url(${fontUrl})`);

    try {
      const loadedFace = await fontFace.load();
      document.fonts.add(loadedFace);
      this.loadedFonts.add(fontName);
    } catch (err) {
      console.warn(`Could not load font WOFF2: ${fontName}, falling back to TTF`, err);
      try {
        const ttfFace = new FontFace(fontName, `url(/fonts/${fileName}.ttf)`);
        const loadedTtf = await ttfFace.load();
        document.fonts.add(loadedTtf);
        this.loadedFonts.add(fontName);
      } catch (e) {
        console.error(`Failed to load font ${fontName}`, e);
      }
    }
  }

  // --- Page Renderer ---
  async loadAndRenderPage(pageNum) {
    if (pageNum < 1 || pageNum > 604) return;
    this.currentPage = pageNum;
    localStorage.setItem('quran_last_page', pageNum.toString());

    this.elements.pageSlider.value = pageNum;
    this.elements.directPageInput.value = pageNum;
    this.elements.lblCurrPageBm.textContent = pageNum;

    // Render loading indicator
    this.elements.mushafPage.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>جاري تحميل الصفحة ${pageNum}...</span>
      </div>
    `;

    try {
      const pageStr = pageNum.toString().padStart(3, '0');
      const response = await fetch(`/pages/${pageStr}.json`);
      if (!response.ok) throw new Error(`Page ${pageNum} not found`);
      
      const pageData = await response.json();

      // Load main page font & Bismillah font
      await Promise.all([
        this.ensureFontLoaded(pageData.font),
        this.ensureFontLoaded('QCF4_QBSML')
      ]);

      // Calculate Header info
      const firstSurah = pageData.surahs && pageData.surahs.length > 0 ? pageData.surahs[0] : null;
      const surahName = firstSurah ? firstSurah.name_arabic : '';
      const juzNum = this.getJuzForPage(pageNum);

      this.elements.headerTitle.textContent = `سورة ${surahName}`;
      this.elements.headerSubtitle.textContent = `صفحة ${pageNum} - الجزء ${juzNum}`;

      // Build HTML for Mushaf Page
      let html = `
        <div class="page-header-info">
          <span>سورة ${surahName}</span>
          <span>الجزء ${juzNum}</span>
        </div>
        <div class="page-lines-container">
      `;

      pageData.lines.forEach(line => {
        html += `<div class="quran-line">`;
        line.words.forEach(w => {
          const fontName = w.font || pageData.font;
          
          if (w.type === 'surah_header') {
            let sName = '';
            if (w.sura && this.indexData && this.indexData.chapters) {
              const ch = this.indexData.chapters.find(c => c.id === w.sura);
              if (ch) sName = ch.name_arabic;
            }
            if (!sName && firstSurah) sName = firstSurah.name_arabic;

            html += `
              <div class="surah-header-wrapper">
                <div class="surah-header-banner">
                  <span>سورة ${sName}</span>
                </div>
              </div>
            `;
          } else if (w.type === 'bismillah') {
            const bText = w.text || 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ';
            const bHtml = bText.replace(/(اللَّهِ|اللَّهَ|اللَّهُ|اللَّهِ|الله)/g, '<span class="word-allah-name">$1</span>');
            html += `
              <div class="bismillah-wrapper">
                <div class="bismillah-container">
                  ${bHtml}
                </div>
              </div>
            `;
          } else {
            const verseKeyAttr = w.verse_key ? `data-verse-key="${w.verse_key}"` : '';
            const isEnd = w.type === 'verse_end';
            const isAllah = this.isDivineNameWord(w.text || '');
            let wordClass = 'quran-word';
            if (isEnd) wordClass += ' word-verse-end';
            if (isAllah) wordClass += ' word-allah-name';

            html += `
              <span class="${wordClass}" ${verseKeyAttr} style="font-family: '${fontName}', serif;" title="${w.text || ''}">
                ${w.char}
              </span>
            `;
          }
        });
        html += `</div>`;
      });

      html += `
        </div>
        <div class="page-footer-info">
          <span>- ${pageNum} -</span>
        </div>
      `;

      this.elements.mushafPage.innerHTML = html;

      // Attach word/verse click listeners
      this.elements.mushafPage.querySelectorAll('.quran-word[data-verse-key]').forEach(wEl => {
        wEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const verseKey = wEl.dataset.verseKey;
          this.openVerseActionSheet(verseKey, wEl);
        });
      });

    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
      this.elements.mushafPage.innerHTML = `
        <div class="loading-spinner">
          <span style="color:#ef4444;">تعذر تحميل الصفحة ${pageNum}</span>
        </div>
      `;
    }
  }

  nextPage() {
    if (this.currentPage < 604) this.loadAndRenderPage(this.currentPage + 1);
  }

  prevPage() {
    if (this.currentPage > 1) this.loadAndRenderPage(this.currentPage - 1);
  }

  getJuzForPage(pageNum) {
    const juzPages = [
      1, 22, 42, 62, 82, 102, 122, 142, 162, 182,
      202, 222, 242, 262, 282, 302, 322, 342, 362, 382,
      402, 422, 442, 462, 482, 502, 522, 542, 562, 582
    ];
    for (let i = juzPages.length - 1; i >= 0; i--) {
      if (pageNum >= juzPages[i]) return i + 1;
    }
    return 1;
  }

  // --- Surah Index ---
  openSurahIndex() {
    if (!this.indexData) return;
    this.renderSurahList(this.indexData.chapters);
    this.openModal(this.elements.modalSurah);
  }

  renderSurahList(chapters) {
    let html = '';
    chapters.forEach(ch => {
      html += `
        <div class="surah-card" data-page="${ch.pages[0]}">
          <div class="surah-num">${ch.id}</div>
          <div class="surah-names">
            <div class="surah-name-ar">سورة ${ch.name_arabic}</div>
            <div class="surah-name-en">${ch.name} (${ch.translated_name})</div>
          </div>
          <div class="surah-page-badge">ص ${ch.pages[0]}</div>
        </div>
      `;
    });
    this.elements.surahListContainer.innerHTML = html;

    this.elements.surahListContainer.querySelectorAll('.surah-card').forEach(card => {
      card.addEventListener('click', () => {
        const page = parseInt(card.dataset.page, 10);
        this.loadAndRenderPage(page);
        this.closeModal(this.elements.modalSurah);
      });
    });
  }

  filterSurahs(query) {
    if (!this.indexData) return;
    const q = query.trim().toLowerCase();
    const filtered = this.indexData.chapters.filter(ch => 
      ch.name_arabic.includes(q) || ch.name.toLowerCase().includes(q) || ch.id.toString() === q
    );
    this.renderSurahList(filtered);
  }

  // --- Juz Index ---
  openJuzIndex() {
    const juzStartPages = [
      1, 22, 42, 62, 82, 102, 122, 142, 162, 182,
      202, 222, 242, 262, 282, 302, 322, 342, 362, 382,
      402, 422, 442, 462, 482, 502, 522, 542, 562, 582
    ];

    let html = '';
    for (let i = 0; i < 30; i++) {
      const jNum = i + 1;
      const startP = juzStartPages[i];
      html += `
        <div class="juz-card" data-page="${startP}">
          <div class="surah-num">${jNum}</div>
          <div class="surah-names">
            <div class="surah-name-ar">الجزء ${jNum}</div>
            <div class="surah-name-en">تبدأ من صفحة ${startP}</div>
          </div>
          <div class="surah-page-badge">ص ${startP}</div>
        </div>
      `;
    }
    this.elements.juzListContainer.innerHTML = html;

    this.elements.juzListContainer.querySelectorAll('.juz-card').forEach(card => {
      card.addEventListener('click', () => {
        const page = parseInt(card.dataset.page, 10);
        this.loadAndRenderPage(page);
        this.closeModal(this.elements.modalJuz);
      });
    });

    this.openModal(this.elements.modalJuz);
  }

  // --- Verse Action & Audio & Tafsir ---
  openVerseActionSheet(verseKey, wordEl) {
    this.selectedVerseKey = verseKey;
    this.selectedWordElement = wordEl;

    // Highlight all words in selected verse
    this.elements.mushafPage.querySelectorAll('.quran-word').forEach(w => w.classList.remove('active-word'));
    this.elements.mushafPage.querySelectorAll(`.quran-word[data-verse-key="${verseKey}"]`).forEach(w => w.classList.add('active-word'));

    this.elements.verseActionTitle.textContent = `الآية (${verseKey})`;
    
    let text = verseKey;
    if (this.versesIndex && this.versesIndex[verseKey]) {
      text = this.versesIndex[verseKey].text || verseKey;
    }
    this.elements.versePreviewText.textContent = text;
    this.elements.tafsirContainer.classList.add('hidden');

    this.openModal(this.elements.modalVerseAction);
  }

  playAyahAudio(verseKey) {
    if (!verseKey) return;
    const [s, v] = verseKey.split(':').map(Number);
    this.currentAudioAyah = { surah: s, verse: v, verseKey };

    // Format for audio CDN e.g., https://cdn.islamic.network/quran/audio/128/ar.alafasy/{verse_number}.mp3
    // Or standard Alafasy verse key e.g., 001001.mp3
    const sStr = s.toString().padStart(3, '0');
    const vStr = v.toString().padStart(3, '0');
    const audioUrl = `https://everyayah.com/data/Alafasy_128kbps/${sStr}${vStr}.mp3`;

    this.audioElement.src = audioUrl;
    this.audioElement.play().then(() => {
      this.isPlaying = true;
      this.updateAudioBarUI();
    }).catch(err => {
      console.error("Audio playback error:", err);
      alert("تعذر تشغيل الصوت. يرجى التوصيل بالإنترنت للاستماع.");
    });
  }

  toggleAudioPlay() {
    if (!this.audioElement.src) return;
    if (this.isPlaying) {
      this.audioElement.pause();
      this.isPlaying = false;
    } else {
      this.audioElement.play();
      this.isPlaying = true;
    }
    this.updateAudioBarUI();
  }

  playNextAyah() {
    if (!this.currentAudioAyah) return;
    let { surah, verse } = this.currentAudioAyah;
    verse += 1;
    const nextKey = `${surah}:${verse}`;
    this.playAyahAudio(nextKey);
  }

  playPrevAyah() {
    if (!this.currentAudioAyah) return;
    let { surah, verse } = this.currentAudioAyah;
    if (verse > 1) {
      verse -= 1;
      const prevKey = `${surah}:${verse}`;
      this.playAyahAudio(prevKey);
    }
  }

  updateAudioBarUI() {
    this.elements.audioBar.classList.remove('hidden');
    if (this.currentAudioAyah) {
      this.elements.audioAyahTitle.textContent = `آية (${this.currentAudioAyah.verseKey})`;
    }
    if (this.isPlaying) {
      this.elements.iconPlay.classList.add('hidden');
      this.elements.iconPause.classList.remove('hidden');
    } else {
      this.elements.iconPlay.classList.remove('hidden');
      this.elements.iconPause.classList.add('hidden');
    }
  }

  closeAudioBar() {
    this.audioElement.pause();
    this.isPlaying = false;
    this.elements.audioBar.classList.add('hidden');
  }

  // --- Tafsir ---
  async loadTafsir(verseKey) {
    this.elements.tafsirContainer.classList.remove('hidden');
    this.elements.tafsirTextContent.textContent = "جاري تحميل التفسير والترجمة...";

    try {
      const [s, v] = verseKey.split(':');
      // Fetch online Tafsir from public Islamic API or show built-in info
      const res = await fetch(`https://api.alquran.cloud/v1/ayah/${verseKey}/ar.muyassar`);
      const data = await res.json();
      if (data.status === 'OK' && data.data) {
        this.currentTafsirData = {
          saadi: data.data.text,
          ibnkathir: `تفسير الآية (${verseKey}): ${data.data.text}`,
          english: `Verse (${verseKey}) translation loading...`
        };
        this.renderTafsirTab('saadi');
      } else {
        throw new Error('API Error');
      }
    } catch (err) {
      this.elements.tafsirTextContent.textContent = `تفسير الآية (${verseKey}): يتطلب الاتصال بالشبكة لتحميل التفاسير المتقدمة.`;
    }
  }

  renderTafsirTab(tab) {
    if (!this.currentTafsirData) return;
    this.elements.tafsirTextContent.textContent = this.currentTafsirData[tab] || 'لا يوجد تفسير';
  }

  // --- Search Engine ---
  async executeSearch() {
    const query = this.elements.quranSearchInput.value.trim();
    if (!query) return;

    this.elements.searchResultsList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span>جاري البحث...</span></div>';
    this.elements.searchResultsStats.textContent = '';

    if (!this.versesIndex) {
      const res = await fetch('/verses.json');
      this.versesIndex = await res.json();
    }

    const results = [];
    const normQuery = this.normalizeArabic(query);

    for (const [vKey, vData] of Object.entries(this.versesIndex)) {
      const text = vData.text || '';
      if (this.normalizeArabic(text).includes(normQuery)) {
        results.push({ verseKey: vKey, text, page: vData.page });
        if (results.length >= 50) break; // Cap at 50 results
      }
    }

    this.elements.searchResultsStats.textContent = `تم العثور على ${results.length} آية`;

    if (results.length === 0) {
      this.elements.searchResultsList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-dim);">لم يتم العثور على نتائج.</div>';
      return;
    }

    let html = '';
    results.forEach(r => {
      html += `
        <div class="surah-card" data-page="${r.page}">
          <div class="surah-num">${r.verseKey}</div>
          <div class="surah-names">
            <div class="surah-name-ar" style="font-size:0.95rem;">${r.text}</div>
          </div>
          <div class="surah-page-badge">ص ${r.page}</div>
        </div>
      `;
    });

    this.elements.searchResultsList.innerHTML = html;

    this.elements.searchResultsList.querySelectorAll('.surah-card').forEach(card => {
      card.addEventListener('click', () => {
        const p = parseInt(card.dataset.page, 10);
        this.loadAndRenderPage(p);
        this.closeModal(this.elements.modalSearch);
      });
    });
  }

  normalizeArabic(text) {
    return text
      .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه');
  }

  // --- Bookmarks ---
  openBookmarks() {
    this.renderBookmarksList();
    this.openModal(this.elements.modalBookmarks);
  }

  addBookmark(page, title) {
    this.bookmarks.unshift({ page, title, date: new Date().toLocaleDateString('ar-EG') });
    localStorage.setItem('quran_bookmarks', JSON.stringify(this.bookmarks));
  }

  renderBookmarksList() {
    if (this.bookmarks.length === 0) {
      this.elements.bookmarksList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-dim);">لا توجد علامات محفوظة حتى الآن.</div>';
      return;
    }

    let html = '';
    this.bookmarks.forEach((bm, idx) => {
      html += `
        <div class="surah-card" data-page="${bm.page}">
          <div class="surah-num">🔖</div>
          <div class="surah-names">
            <div class="surah-name-ar">${bm.title}</div>
            <div class="surah-name-en">${bm.date}</div>
          </div>
          <button class="icon-btn del-bm-btn" data-idx="${idx}" style="color:#ef4444;">✕</button>
        </div>
      `;
    });

    this.elements.bookmarksList.innerHTML = html;

    this.elements.bookmarksList.querySelectorAll('.surah-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('del-bm-btn')) return;
        const p = parseInt(card.dataset.page, 10);
        this.loadAndRenderPage(p);
        this.closeModal(this.elements.modalBookmarks);
      });
    });

    this.elements.bookmarksList.querySelectorAll('.del-bm-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        this.bookmarks.splice(idx, 1);
        localStorage.setItem('quran_bookmarks', JSON.stringify(this.bookmarks));
        this.renderBookmarksList();
      });
    });
  }

  // --- Theme Manager ---
  loadTheme() {
    const savedTheme = localStorage.getItem('quran_theme') || 'paper';
    this.setTheme(savedTheme);
  }

  setTheme(theme) {
    document.body.className = `theme-${theme}`;
    localStorage.setItem('quran_theme', theme);
    document.querySelectorAll('.theme-card').forEach(c => {
      c.classList.toggle('active', c.dataset.theme === theme);
    });
  }

  // --- Modal Helpers ---
  openModal(modalEl) {
    if (modalEl) modalEl.classList.remove('hidden');
  }

  closeModal(modalEl) {
    if (modalEl) modalEl.classList.add('hidden');
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.quranApp = new QuranApp();
});
