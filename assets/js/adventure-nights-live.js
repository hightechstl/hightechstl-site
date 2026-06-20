(() => {
  const config = window.ADVENTURE_NIGHTS_CONFIG;
  if (!config) return;

  const state = {
    bundle: null,
    step: 'intro',
    selectedRoleId: '',
    revealedPrompts: new Set(),
    unlockedClues: new Set(),
    endingId: '',
    user: null,
    ownedAdventureIds: [],
    ownedAdventureEditions: {},
    authReady: false,
    accessLoaded: false
  };

  const flow = ['intro', 'roles', 'scene-1', 'scene-2', 'scene-3', 'scene-4', 'choice', 'ending'];
  const flowLabels = {
    intro: 'Intro',
    roles: 'Role Select',
    'scene-1': 'Scene 1',
    'scene-2': 'Scene 2',
    'scene-3': 'Scene 3',
    'scene-4': 'Scene 4',
    choice: 'Final Choice',
    ending: 'Ending'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const asset = (path = '') => `${config.assetBaseUrl}${path}`;
  const isOwned = () => state.ownedAdventureIds.includes(state.bundle?.adventure?.id);
  const currentScene = () => state.bundle.gameContent.scenes.find((scene) => scene.id === state.step);
  const currentSceneIndex = () => state.bundle.gameContent.scenes.findIndex((scene) => scene.id === state.step);

  async function loadBundle() {
    const response = await fetch(config.bundleUrl);
    if (!response.ok) throw new Error(`Could not load Adventure Nights bundle: ${response.status}`);
    return response.json();
  }

  function firebaseReady() {
    const firebaseConfig = window.HIGH_TECH_STL_FIREBASE_CONFIG;
    return window.firebase && firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('REPLACE_ME');
  }

  function getFirebaseServices() {
    if (!firebaseReady()) return {};
    if (!firebase.apps.length) firebase.initializeApp(window.HIGH_TECH_STL_FIREBASE_CONFIG);
    return {
      auth: firebase.auth(),
      functions: firebase.app().functions(config.firebaseRegion || 'us-central1')
    };
  }

  function readableError(error) {
    if (error?.code === 'auth/invalid-credential') return 'The email or password is incorrect.';
    if (error?.code === 'auth/email-already-in-use') return 'That email already has an account. Sign in or reset the password.';
    if (error?.code === 'auth/weak-password') return 'Use a password with at least 6 characters.';
    if (error?.code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment and try again.';
    if (['unauthenticated', 'functions/unauthenticated'].includes(error?.code)) return 'Sign in to load purchased adventures.';
    console.error(error);
    return error?.message || 'Something went wrong. Please try again.';
  }

  function setPlatformMessage(message, isError = false) {
    const element = $('[data-platform-message]');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('error', isError);
  }

  function setPlatformBusy(isBusy) {
    ['[data-platform-sign-in]', '[data-platform-create]', '[data-platform-reset]'].forEach((selector) => {
      const button = $(selector);
      if (button) button.disabled = isBusy;
    });
  }

  async function loadAccess() {
    if (!state.user || !firebaseReady()) {
      state.ownedAdventureIds = [];
      state.ownedAdventureEditions = {};
      state.accessLoaded = true;
      return;
    }

    const {functions} = getFirebaseServices();
    const getAdventureAccess = functions.httpsCallable('getAdventureAccess');
    const result = await getAdventureAccess();
    state.ownedAdventureIds = result.data?.ownedAdventureIds || [];
    state.ownedAdventureEditions = result.data?.ownedAdventureEditions || {};
    state.accessLoaded = true;
  }

  function updatePlatformAccount() {
    const login = $('[data-platform-login]');
    const account = $('[data-platform-account]');
    const email = $('[data-platform-email]');
    const count = $('[data-platform-owned-count]');
    if (!login || !account) return;

    login.hidden = Boolean(state.user);
    account.hidden = !state.user;
    if (email) email.textContent = state.user?.email || '';
    if (count) {
      const ownedCount = state.ownedAdventureIds.length;
      count.textContent = `${ownedCount} purchased adventure${ownedCount === 1 ? '' : 's'} loaded.`;
    }
  }

  function attachAuthEvents() {
    if (!firebaseReady()) {
      setPlatformMessage('Firebase is not configured yet. Purchased library login is unavailable.', true);
      return;
    }

    const {auth} = getFirebaseServices();
    const login = $('[data-platform-login]');

    login?.addEventListener('submit', async (event) => {
      event.preventDefault();
      setPlatformBusy(true);
      setPlatformMessage('Signing in...');
      try {
        await auth.signInWithEmailAndPassword(login.email.value.trim(), login.password.value);
        login.reset();
      } catch (error) {
        setPlatformMessage(readableError(error), true);
      } finally {
        setPlatformBusy(false);
      }
    });

    $('[data-platform-create]')?.addEventListener('click', async () => {
      if (!login) return;
      setPlatformBusy(true);
      setPlatformMessage('Creating account...');
      try {
        await auth.createUserWithEmailAndPassword(login.email.value.trim(), login.password.value);
        login.reset();
      } catch (error) {
        setPlatformMessage(readableError(error), true);
      } finally {
        setPlatformBusy(false);
      }
    });

    $('[data-platform-reset]')?.addEventListener('click', async () => {
      if (!login?.email.value.trim()) {
        setPlatformMessage('Enter your email first, then reset the password.', true);
        return;
      }
      setPlatformBusy(true);
      try {
        await auth.sendPasswordResetEmail(login.email.value.trim());
        setPlatformMessage('Password reset email sent.');
      } catch (error) {
        setPlatformMessage(readableError(error), true);
      } finally {
        setPlatformBusy(false);
      }
    });

    $('[data-platform-sign-out]')?.addEventListener('click', () => auth.signOut());

    auth.onAuthStateChanged(async (user) => {
      state.user = user;
      state.accessLoaded = false;
      try {
        await loadAccess();
        setPlatformMessage(user ? 'Purchased adventures loaded.' : 'Sign in to load purchases.');
      } catch (error) {
        state.ownedAdventureIds = [];
        state.ownedAdventureEditions = {};
        setPlatformMessage(readableError(error), true);
      }
      updatePlatformAccount();
      if (state.bundle) {
        if (config.mode === 'library') renderLibrary(state.bundle);
        if (config.mode === 'player') renderPlayer();
        renderDownloads(state.bundle);
      }
    });
  }

  function renderLibrary(bundle) {
    const adventure = bundle.adventure;
    const tile = bundle.portalPresentation.libraryTile;
    const library = $('[data-adventure-library]');
    if (!library) return;
    const owned = isOwned();
    const signedIn = Boolean(state.user);
    const detailHref = config.detailUrl || config.playUrl || '#';
    const secondary = owned
      ? '<span class="owned-pill">Purchased</span>'
      : signedIn
        ? '<span class="locked-pill">Not purchased</span>'
        : '<span class="locked-pill">Sign in to check access</span>';

    library.innerHTML = `
      <article class="live-adventure-card">
        <img src="${esc(asset(tile.thumbnailAsset))}" alt="${esc(tile.title)} cover art">
        <div class="live-adventure-card-body">
          <div class="live-kicker">${esc(tile.genre)} · ${esc(tile.duration)} · ${esc(tile.players)} players</div>
          <h3>${esc(tile.title)}</h3>
          <p>${esc(tile.summary || adventure.summary)}</p>
          <div class="edition-mini-grid">
            <div><strong>Quick-Play</strong><span>Complete, lower-cost, simple assets.</span></div>
            <div><strong>Deluxe</strong><span>Premium scene art and collectible files.</span></div>
          </div>
          <div class="live-card-meta"><span>${esc(tile.mood)}</span><span>${esc(tile.difficulty)}</span></div>
          <div class="platform-card-actions">
            <a class="button button-secondary" href="${esc(detailHref)}">View Adventure</a>
            ${owned ? `<a class="button button-primary" href="${esc(config.playUrl)}">Play Online</a>` : ''}
            <a class="button button-primary" href="${esc(config.buyQuickUrl || config.buyUrl || '#')}" target="_blank" rel="noopener">Buy Quick-Play</a>
            <a class="button button-blue" href="${esc(config.buyDeluxeUrl || config.buyUrl || '#')}" target="_blank" rel="noopener">Buy Deluxe</a>
            ${secondary}
          </div>
        </div>
      </article>
      ${signedIn && !state.ownedAdventureIds.length ? `
        <div class="live-note">
          <strong>No purchases found yet</strong>
          <p>Buy an adventure on J2 Crafts with this same email address. If you already purchased with a different email, use the redeem page.</p>
          <a class="button button-secondary" href="${esc(config.redeemUrl || '#')}">Redeem Code</a>
        </div>
      ` : ''}
    `;
  }

  function setCover(bundle) {
    const adventure = bundle.adventure;
    const tile = bundle.portalPresentation.libraryTile;
    $('[data-live-title]') && ($('[data-live-title]').textContent = adventure.title);
    $('[data-live-summary]') && ($('[data-live-summary]').textContent = adventure.summary);
    $('[data-live-genre]') && ($('[data-live-genre]').textContent = adventure.type);
    $('[data-live-time]') && ($('[data-live-time]').textContent = adventure.time);
    $('[data-live-players]') && ($('[data-live-players]').textContent = `${adventure.players} players`);
    const thumbnail = $('[data-live-thumbnail]');
    if (thumbnail) {
      thumbnail.src = asset(tile.thumbnailAsset);
      thumbnail.alt = `${adventure.title} cover art`;
    }
  }

  function setStep(step) {
    state.step = step;
    if (step.startsWith('scene-')) {
      const scene = currentScene();
      scene?.unlocks?.forEach((id) => state.unlockedClues.add(id));
    }
    renderPlayer();
  }

  function stepIndex(step) {
    return flow.indexOf(step);
  }

  function renderFlowNav() {
    const nav = $('[data-flow-nav]');
    if (!nav) return;
    const activeIndex = stepIndex(state.step);
    nav.innerHTML = flow.map((step, index) => `
      <button type="button" class="${step === state.step ? 'active' : ''}" data-flow-step="${esc(step)}" ${index <= activeIndex + 1 ? '' : 'disabled'}>
        ${esc(flowLabels[step])}
      </button>
    `).join('');
  }

  function sceneArt(scene) {
    return state.bundle.portalPresentation.sceneArt.find((item) => item.sceneId === scene.id);
  }

  function renderIntro() {
    const adventure = state.bundle.adventure;
    return `
      <article class="live-panel live-intro-panel">
        <div>
          <p class="live-kicker">${esc(adventure.mood)}</p>
          <h2>${esc(adventure.title)}</h2>
          <p>${esc(adventure.summary)}</p>
          <div class="live-beats">${adventure.beats.map((beat) => `<p>${esc(beat)}</p>`).join('')}</div>
          <button class="button button-primary" type="button" data-next-step="roles">Choose Roles</button>
        </div>
        <div class="live-map-stack">
          <img src="${esc(asset('assets/map.svg'))}" alt="${esc(adventure.kit.mapDesc)}">
          <img src="${esc(asset('assets/tokens.svg'))}" alt="Printable player tokens for the two roles">
        </div>
      </article>
    `;
  }

  function renderRoles() {
    const roles = state.bundle.gameContent.roles;
    return `
      <article class="live-panel">
        <p class="live-kicker">Role Select</p>
        <h2>Choose Seat A or Seat B</h2>
        <p>Pick a role for this device, or read both role cards together before starting Scene 1.</p>
        <div class="role-grid">
          ${roles.map((role, index) => `
            <button type="button" class="role-card ${state.selectedRoleId === role.id ? 'selected' : ''}" data-role-id="${esc(role.id)}">
              <span>Seat ${index + 1}</span>
              <strong>${esc(role.name)}</strong>
              <small>${esc(role.privateGoal)}</small>
              <em>${esc(role.startingPrompt)}</em>
            </button>
          `).join('')}
        </div>
        <div class="live-actions">
          <button class="button button-secondary" type="button" data-next-step="intro">Back</button>
          <button class="button button-primary" type="button" data-next-step="scene-1">Begin Scene 1</button>
        </div>
      </article>
    `;
  }

  function clueOwnerClass(clue) {
    return clue.owner.toLowerCase().includes('wick') ? 'seat-one' : 'seat-two';
  }

  function renderUnlockedClues() {
    const clues = state.bundle.gameContent.clues.filter((clue) => state.unlockedClues.has(clue.id));
    if (!clues.length) return '<p class="live-empty">Clues unlock as scenes progress.</p>';
    return clues.map((clue) => `
      <article class="clue-card ${clueOwnerClass(clue)}">
        <span>${esc(clue.owner)} · ${esc(clue.type)}</span>
        <strong>${esc(clue.title)}</strong>
        <p>${esc(clue.front)}</p>
        <details><summary>Reveal back</summary><p>${esc(clue.back)}</p></details>
      </article>
    `).join('');
  }

  function renderScene() {
    const scene = currentScene();
    const art = sceneArt(scene);
    const sceneIndex = currentSceneIndex();
    const nextStep = sceneIndex === state.bundle.gameContent.scenes.length - 1
      ? 'choice'
      : state.bundle.gameContent.scenes[sceneIndex + 1].id;
    const previousStep = sceneIndex === 0 ? 'roles' : state.bundle.gameContent.scenes[sceneIndex - 1].id;
    const seatOneRevealed = state.revealedPrompts.has(`${scene.id}:one`);
    const seatTwoRevealed = state.revealedPrompts.has(`${scene.id}:two`);

    return `
      <article class="live-scene-layout">
        <section class="live-panel scene-main">
          <p class="live-kicker">Scene ${sceneIndex + 1} · ${scene.durationMinutes} minutes</p>
          <h2>${esc(scene.title)}</h2>
          ${art ? `<img class="scene-art" src="${esc(asset(art.asset))}" alt="${esc(art.alt)}">` : ''}
          <p>${esc(scene.sharedPrompt)}</p>
          <div class="prompt-grid">
            <div class="private-prompt">
              <button type="button" class="button button-secondary" data-reveal-prompt="${esc(scene.id)}:one">${seatOneRevealed ? 'Hide Seat 1 Prompt' : 'Reveal Seat 1 Prompt'}</button>
              <p ${seatOneRevealed ? '' : 'hidden'}>${esc(scene.playerOnePrompt)}</p>
            </div>
            <div class="private-prompt">
              <button type="button" class="button button-secondary" data-reveal-prompt="${esc(scene.id)}:two">${seatTwoRevealed ? 'Hide Seat 2 Prompt' : 'Reveal Seat 2 Prompt'}</button>
              <p ${seatTwoRevealed ? '' : 'hidden'}>${esc(scene.playerTwoPrompt)}</p>
            </div>
          </div>
          <div class="scene-task"><strong>Table action</strong><p>${esc(scene.mechanic)}</p><strong>Unlock</strong><p>${esc(scene.successState)}</p></div>
          <div class="live-actions">
            <button class="button button-secondary" type="button" data-next-step="${esc(previousStep)}">Back</button>
            <button class="button button-primary" type="button" data-next-step="${esc(nextStep)}">${nextStep === 'choice' ? 'Make Final Choice' : 'Continue'}</button>
          </div>
        </section>
        <aside class="live-panel live-side-panel">
          <h3>Map</h3>
          <img class="live-map" src="${esc(asset('assets/map.svg'))}" alt="${esc(state.bundle.adventure.kit.mapDesc)}">
          <h3>Unlocked Clues</h3>
          <div class="clue-grid">${renderUnlockedClues()}</div>
        </aside>
      </article>
    `;
  }

  function renderChoice() {
    const choice = state.bundle.gameContent.finalChoice;
    return `
      <article class="live-panel">
        <p class="live-kicker">Final Choice</p>
        <h2>${esc(choice.prompt)}</h2>
        <p>Talk it through together. When you choose, the ending card will appear.</p>
        <div class="choice-grid">
          ${choice.options.map((option) => `
            <button class="choice-card" type="button" data-ending-id="${esc(option.id)}">
              <strong>${esc(option.label)}</strong>
              <span>${esc(option.outcome)}</span>
            </button>
          `).join('')}
        </div>
        <div class="live-actions"><button class="button button-secondary" type="button" data-next-step="scene-4">Back</button></div>
      </article>
    `;
  }

  function renderEnding() {
    const endings = state.bundle.gameContent.endings;
    const selected = endings[state.endingId] || endings.split || Object.values(endings)[0];
    return `
      <article class="live-panel ending-panel">
        <p class="live-kicker">Ending</p>
        <h2>${esc(selected.title)}</h2>
        <p>${esc(selected.readAloud)}</p>
        <div class="epilogue-grid">
          ${selected.epilogues.map((epilogue) => `<article><strong>Epilogue</strong><p>${esc(epilogue)}</p></article>`).join('')}
        </div>
        <div class="live-actions">
          <button class="button button-secondary" type="button" data-next-step="choice">Choose Again</button>
          <a class="button button-primary" href="#downloads">Download Print Pack</a>
        </div>
      </article>
    `;
  }

  function renderDownloads(bundle) {
    const downloads = $('[data-downloads]');
    if (!downloads) return;
    if (config.requireOwnership && !isOwned()) {
      downloads.innerHTML = `
        <div class="live-note">
          <strong>Downloads locked</strong>
          <p>Log in with an account that owns this adventure to load the print-ready files.</p>
        </div>
      `;
      return;
    }

    const printAssets = bundle.downloadables.printAssets || [];
    const visualAssets = bundle.downloadables.visualAssets || [];
    downloads.innerHTML = [...printAssets, ...visualAssets].map((item) => `
      <a class="download-card" href="${esc(asset(item.file))}" target="_blank" rel="noopener">
        <strong>${esc(item.label)}</strong>
        <span>${esc(item.format.toUpperCase())}</span>
      </a>
    `).join('');
  }

  function renderPlayer() {
    const stage = $('[data-live-stage]');
    if (!stage) return;

    if (config.requireOwnership && !isOwned()) {
      stage.innerHTML = `
        <article class="live-panel platform-gate">
          <p class="live-kicker">Purchased adventure required</p>
          <h2>Log in to load this adventure</h2>
          <p>${state.user ? 'This account does not own this adventure yet.' : 'Sign in from the Adventure Nights library to load purchased adventures.'}</p>
          <div class="live-actions">
            <a class="button button-primary" href="${esc(config.libraryUrl || '../')}">Sign In</a>
            <a class="button button-secondary" href="${esc(config.redeemUrl || `${config.libraryUrl || '../'}redeem/`)}">Redeem Code</a>
            <a class="button button-primary" href="${esc(config.buyQuickUrl || config.buyUrl || '#')}" target="_blank" rel="noopener">Buy Quick-Play</a>
            <a class="button button-blue" href="${esc(config.buyDeluxeUrl || config.buyUrl || '#')}" target="_blank" rel="noopener">Buy Deluxe</a>
          </div>
        </article>
      `;
      const nav = $('[data-flow-nav]');
      if (nav) nav.innerHTML = '';
      return;
    }

    renderFlowNav();
    if (state.step === 'intro') stage.innerHTML = renderIntro();
    else if (state.step === 'roles') stage.innerHTML = renderRoles();
    else if (state.step.startsWith('scene-')) stage.innerHTML = renderScene();
    else if (state.step === 'choice') stage.innerHTML = renderChoice();
    else if (state.step === 'ending') stage.innerHTML = renderEnding();
  }

  function attachPlayerEvents() {
    const player = $('[data-adventure-player]');
    if (!player) return;

    player.addEventListener('click', (event) => {
      const next = event.target.closest('[data-next-step]');
      const role = event.target.closest('[data-role-id]');
      const reveal = event.target.closest('[data-reveal-prompt]');
      const ending = event.target.closest('[data-ending-id]');
      const flowButton = event.target.closest('[data-flow-step]');

      if (next) {
        setStep(next.dataset.nextStep);
      } else if (role) {
        state.selectedRoleId = role.dataset.roleId;
        renderPlayer();
      } else if (reveal) {
        const key = reveal.dataset.revealPrompt;
        state.revealedPrompts.has(key) ? state.revealedPrompts.delete(key) : state.revealedPrompts.add(key);
        renderPlayer();
      } else if (ending) {
        state.endingId = ending.dataset.endingId;
        setStep('ending');
      } else if (flowButton && !flowButton.disabled) {
        setStep(flowButton.dataset.flowStep);
      }
    });
  }

  async function init() {
    try {
      const bundle = await loadBundle();
      state.bundle = bundle;

      if (config.mode === 'library') renderLibrary(bundle);
      if (config.mode === 'player') {
        setCover(bundle);
        renderDownloads(bundle);
        attachAuthEvents();
        attachPlayerEvents();
        renderPlayer();
      }
      if (config.mode === 'library') attachAuthEvents();
    } catch (error) {
      console.error(error);
      const container = $('[data-adventure-library]') || $('[data-live-stage]');
      if (container) container.innerHTML = '<p class="live-error">Adventure content could not be loaded. Check the bundle path and try again.</p>';
    }
  }

  init();
})();
