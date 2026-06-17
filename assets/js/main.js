const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('.site-nav');

if (navToggle && siteNav) {
  navToggle.addEventListener('click', () => {
    const open = siteNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.textContent = open ? '×' : '☰';
  });

  siteNav.addEventListener('click', (event) => {
    if (event.target.matches('a')) {
      siteNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.textContent = '☰';
    }
  });
}

document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = new Date().getFullYear();
});

const adventureApp = document.querySelector('[data-adventure-app]');

if (adventureApp) {
  const adventures = [
    {
      id: 'gilded-archive',
      title: 'Whispers in the Gilded Archive',
      type: 'Mystery',
      time: '60 min',
      purchased: true,
      invite: 'https://hightechstl.com/play/gilded-archive?seat=2',
      summary: 'Play anytime and download the full package. This adventure is already owned.',
      beats: [
        'Read the first scene together and place both tokens in the reading room.',
        'Each player receives private prompts that unlock when both are ready.',
        'Use the shared map, clues, and final choice to close the mystery.'
      ]
    },
    {
      id: 'signal-on-meridian-roof',
      title: 'Signal on Meridian Roof',
      type: 'Sci-fi',
      time: '55 min',
      purchased: false,
      invite: 'https://hightechstl.com/play/meridian-roof?seat=2',
      summary: 'Included with subscription play. Permanent downloads unlock after purchase.',
      beats: [
        'Climb the tower route and divide the comms repair steps between both players.',
        'Decode the signal by matching rooftop markers with private transmission cards.',
        'Choose whether to broadcast, bury, or reroute the final message.'
      ]
    },
    {
      id: 'lanterns-under-foxglove',
      title: 'Lanterns Under Foxglove',
      type: 'Folklore',
      time: '60 min',
      purchased: false,
      invite: 'https://hightechstl.com/play/foxglove?seat=2',
      summary: 'Subscription access is active. Buy it once to keep and print the resources.',
      beats: [
        'Follow the lantern trail and mark safe crossings on the shared grove map.',
        'Trade whispered vows and omen cards before the moon dial reaches midnight.',
        'Resolve the pact with a final two-player choice.'
      ]
    },
    {
      id: 'last-table-at-ember-house',
      title: 'Last Table at Ember House',
      type: 'Cozy heist',
      time: '50 min',
      purchased: true,
      invite: 'https://hightechstl.com/play/ember-house?seat=2',
      summary: 'Owned adventure. Downloads and replay access are permanently unlocked.',
      beats: [
        'Enter the supper club with separate cover stories and one shared objective.',
        'Use menu clues, token placement, and timed prompts to reach the back office.',
        'Decide who takes the ledger and who distracts the room.'
      ]
    }
  ];

  const previewOwnedAdventureIds = adventures.filter((adventure) => adventure.purchased).map((adventure) => adventure.id);
  const defaultSubscriptionUrl = 'https://www.j2crafts.com/products/adventure-nights-monthly-library';
  const resources = [
    ['MAP', 'Adventure map', 'Printable table map'],
    ['TOK', 'Player tokens', 'Cutout token sheet'],
    ['STY', 'Storyboard', 'Scene-by-scene guide'],
    ['CLU', 'Clue deck', 'Private prompt cards']
  ];

  let selectedAdventure = adventures[0];
  let currentUser = null;
  let accessState = {
    loaded: false,
    signedIn: false,
    subscriptionActive: true,
    subscriptionStatus: 'preview',
    activeUntil: null,
    checkoutUrl: defaultSubscriptionUrl,
    ownedAdventureIds: previewOwnedAdventureIds
  };

  const list = adventureApp.querySelector('[data-adventure-list]');
  const title = adventureApp.querySelector('[data-selected-title]');
  const type = adventureApp.querySelector('[data-selected-type]');
  const time = adventureApp.querySelector('[data-selected-time]');
  const accessTitle = adventureApp.querySelector('[data-access-title]');
  const accessCopy = adventureApp.querySelector('[data-access-copy]');
  const accessLight = adventureApp.querySelector('[data-access-light]');
  const inviteInput = adventureApp.querySelector('#invite-link');
  const resourceList = adventureApp.querySelector('[data-resource-list]');
  const storyOne = adventureApp.querySelector('[data-story-one]');
  const storyTwo = adventureApp.querySelector('[data-story-two]');
  const storyThree = adventureApp.querySelector('[data-story-three]');
  const modeLabel = adventureApp.querySelector('[data-mode-label]');
  const copyStatus = adventureApp.querySelector('[data-copy-status]');
  const purchaseButton = adventureApp.querySelector('[data-purchase-adventure]');
  const startButton = adventureApp.querySelector('[data-start-adventure]');
  const toggleMode = adventureApp.querySelector('[data-toggle-mode]');
  const loginForm = adventureApp.querySelector('[data-adventure-login-form]');
  const loginMessage = adventureApp.querySelector('[data-login-message]');
  const loginButton = adventureApp.querySelector('[data-login-button]');
  const createAccountButton = adventureApp.querySelector('[data-create-account]');
  const resetPasswordButton = adventureApp.querySelector('[data-reset-password]');
  const accountPanel = adventureApp.querySelector('[data-adventure-account]');
  const accountTitle = adventureApp.querySelector('[data-account-title]');
  const signedInEmail = adventureApp.querySelector('[data-signed-in-email]');
  const signOutButton = adventureApp.querySelector('[data-sign-out]');
  const planLabel = adventureApp.querySelector('[data-plan-label]');
  const subscribeNow = adventureApp.querySelector('[data-subscribe-now]');

  let auth = null;
  let functions = null;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const formatDate = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {dateStyle: 'medium'}).format(date);
  };

  const readableError = (error) => {
    if (error?.code === 'auth/invalid-credential') return 'The email or password is incorrect.';
    if (error?.code === 'auth/email-already-in-use') return 'That email already has an account. Sign in or reset the password.';
    if (error?.code === 'auth/weak-password') return 'Use a password with at least 6 characters.';
    if (error?.code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment and try again.';
    if (['unauthenticated', 'functions/unauthenticated'].includes(error?.code)) return 'Sign in to load Adventure Nights access.';
    console.error(error);
    return error?.message || 'Something went wrong. Please try again.';
  };

  const setLoginMessage = (message, isError = false) => {
    loginMessage.textContent = message;
    loginMessage.classList.toggle('error', isError);
  };

  const setAuthBusy = (isBusy) => {
    loginButton.disabled = isBusy;
    createAccountButton.disabled = isBusy;
    resetPasswordButton.disabled = isBusy;
  };

  const adventureIsOwned = (adventure) => accessState.ownedAdventureIds.includes(adventure.id);
  const adventureCanPlay = (adventure) => adventureIsOwned(adventure) || accessState.subscriptionActive;
  const hasAnyAccess = () => accessState.subscriptionActive || accessState.ownedAdventureIds.length > 0;

  const applyAccessToAdventures = () => {
    adventures.forEach((adventure) => {
      adventure.purchased = adventureIsOwned(adventure);
    });
  };

  const updateAccountUI = () => {
    loginForm.hidden = accessState.signedIn;
    accountPanel.hidden = !accessState.signedIn;
    accountTitle.textContent = accessState.signedIn ? 'Account ready' : 'Sign in to play';
    signedInEmail.textContent = currentUser?.email || '';
    subscribeNow.hidden = hasAnyAccess();
    subscribeNow.href = accessState.checkoutUrl || defaultSubscriptionUrl;

    if (!accessState.signedIn) {
      planLabel.textContent = 'Preview mode';
      return;
    }

    if (accessState.subscriptionActive) {
      const activeUntil = formatDate(accessState.activeUntil);
      planLabel.textContent = activeUntil ? `Subscribed through ${activeUntil}` : 'Subscription active';
    } else if (accessState.ownedAdventureIds.length > 0) {
      planLabel.textContent = 'Purchased access';
    } else {
      planLabel.textContent = 'No active adventures';
    }
  };

  const renderAdventureList = () => {
    list.innerHTML = adventures.map((adventure) => `
      <button class="adventure-choice ${adventureCanPlay(adventure) ? '' : 'locked'}" type="button" data-adventure-id="${escapeHtml(adventure.id)}" aria-selected="${adventure.id === selectedAdventure.id}">
        <strong>${escapeHtml(adventure.title)}</strong>
        <span><em>${escapeHtml(adventure.type)}</em><b>${adventureIsOwned(adventure) ? 'Owned' : adventureCanPlay(adventure) ? 'Subscription' : 'Locked'}</b></span>
      </button>
    `).join('');
    const purchasedCount = accessState.ownedAdventureIds.length;
    modeLabel.textContent = accessState.signedIn ? `${purchasedCount} purchased` : `${purchasedCount} preview owned`;
  };

  const renderResources = () => {
    const unlocked = adventureIsOwned(selectedAdventure);
    resourceList.innerHTML = resources.map(([icon, name, detail]) => `
      <div class="resource-item ${unlocked ? 'unlocked' : ''}">
        <span class="resource-icon">${escapeHtml(icon)}</span>
        <div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(detail)}</span></div>
        <button class="resource-action" type="button" ${unlocked ? '' : 'disabled'} data-download-resource="${escapeHtml(name)}">${unlocked ? 'Download' : 'Locked'}</button>
      </div>
    `).join('');
  };

  const renderSelectedAdventure = () => {
    title.textContent = selectedAdventure.title;
    type.textContent = selectedAdventure.type;
    time.textContent = selectedAdventure.time;
    const owned = adventureIsOwned(selectedAdventure);
    const canPlay = adventureCanPlay(selectedAdventure);
    accessTitle.textContent = owned ? 'Purchased' : canPlay ? 'Subscribed' : 'Subscribe to Play';
    accessCopy.textContent = owned
      ? 'Permanent access is active. Downloads and replay access are unlocked.'
      : canPlay
        ? 'Play this adventure while your subscription is active. Permanent downloads unlock when this adventure is purchased.'
        : 'Create an account or subscribe to unlock this adventure for browser play.';
    accessLight.classList.toggle('unlocked', owned || canPlay);
    inviteInput.value = selectedAdventure.invite;
    storyOne.textContent = selectedAdventure.beats[0];
    storyTwo.textContent = selectedAdventure.beats[1];
    storyThree.textContent = selectedAdventure.beats[2];
    startButton.disabled = !canPlay;
    startButton.textContent = canPlay ? 'Start Adventure' : 'Subscribe to Start';
    purchaseButton.textContent = owned ? 'Permanent Access Active' : 'Buy Permanent Access';
    purchaseButton.disabled = owned;
    copyStatus.textContent = 'Ready for player two.';
    updateAccountUI();
    renderAdventureList();
    renderResources();
  };

  const loadAdventureAccess = async () => {
    if (!functions || !currentUser) return;
    setLoginMessage('Loading Adventure Nights access...');
    try {
      const result = await functions.httpsCallable('getAdventureAccess')();
      const subscription = result.data?.subscription || {};
      accessState = {
        loaded: true,
        signedIn: true,
        subscriptionActive: subscription.active === true,
        subscriptionStatus: subscription.status || 'none',
        activeUntil: subscription.activeUntil || null,
        checkoutUrl: subscription.checkoutUrl || defaultSubscriptionUrl,
        ownedAdventureIds: result.data?.ownedAdventureIds || []
      };
      applyAccessToAdventures();
      setLoginMessage('Access loaded.');
      renderSelectedAdventure();
    } catch (error) {
      accessState = {
        ...accessState,
        loaded: false,
        signedIn: true,
        subscriptionActive: false,
        ownedAdventureIds: []
      };
      applyAccessToAdventures();
      setLoginMessage(readableError(error), true);
      renderSelectedAdventure();
    }
  };

  const resetToPreviewAccess = () => {
    currentUser = null;
    accessState = {
      loaded: false,
      signedIn: false,
      subscriptionActive: true,
      subscriptionStatus: 'preview',
      activeUntil: null,
      checkoutUrl: defaultSubscriptionUrl,
      ownedAdventureIds: previewOwnedAdventureIds
    };
    applyAccessToAdventures();
    renderSelectedAdventure();
  };

  const initializeAdventureAuth = () => {
    const config = window.HIGH_TECH_STL_FIREBASE_CONFIG;
    const configReady = window.firebase && config && config.apiKey && !config.apiKey.includes('REPLACE_ME');

    if (!configReady) {
      setLoginMessage('Firebase is not configured yet. Preview mode is available.', true);
      setAuthBusy(true);
      return;
    }

    if (!firebase.apps.length) firebase.initializeApp(config);
    auth = firebase.auth();
    functions = firebase.app().functions('us-central1');

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setAuthBusy(true);
      setLoginMessage('Signing in...');
      try {
        await auth.signInWithEmailAndPassword(
          loginForm.email.value.trim(),
          loginForm.password.value
        );
        loginForm.reset();
      } catch (error) {
        setLoginMessage(readableError(error), true);
      } finally {
        setAuthBusy(false);
      }
    });

    createAccountButton.addEventListener('click', async () => {
      setAuthBusy(true);
      setLoginMessage('Creating account...');
      try {
        await auth.createUserWithEmailAndPassword(
          loginForm.email.value.trim(),
          loginForm.password.value
        );
        loginForm.reset();
      } catch (error) {
        setLoginMessage(readableError(error), true);
      } finally {
        setAuthBusy(false);
      }
    });

    resetPasswordButton.addEventListener('click', async () => {
      const email = loginForm.email.value.trim();
      if (!email) {
        setLoginMessage('Enter your email first, then reset the password.', true);
        return;
      }
      setAuthBusy(true);
      try {
        await auth.sendPasswordResetEmail(email);
        setLoginMessage('Password reset email sent.');
      } catch (error) {
        setLoginMessage(readableError(error), true);
      } finally {
        setAuthBusy(false);
      }
    });

    signOutButton.addEventListener('click', () => auth.signOut());

    auth.onAuthStateChanged(async (user) => {
      currentUser = user;
      if (!user) {
        resetToPreviewAccess();
        return;
      }
      signedInEmail.textContent = user.email || user.uid;
      await loadAdventureAccess();
    });
  };

  list.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-adventure-id]');
    if (!choice) return;
    selectedAdventure = adventures.find((adventure) => adventure.id === choice.dataset.adventureId) || selectedAdventure;
    renderSelectedAdventure();
  });

  adventureApp.querySelector('[data-copy-invite]').addEventListener('click', async () => {
    inviteInput.select();
    try {
      await navigator.clipboard.writeText(inviteInput.value);
      copyStatus.textContent = 'Invite link copied.';
    } catch {
      copyStatus.textContent = 'Invite link selected.';
    }
  });

  purchaseButton.addEventListener('click', () => {
    copyStatus.textContent = 'Permanent purchase checkout is coming next.';
  });

  startButton.addEventListener('click', () => {
    if (!adventureCanPlay(selectedAdventure)) {
      copyStatus.textContent = 'Subscribe to start this adventure.';
      return;
    }
    copyStatus.textContent = `Starting ${selectedAdventure.title}.`;
  });

  resourceList.addEventListener('click', (event) => {
    const resourceButton = event.target.closest('[data-download-resource]');
    if (!resourceButton || resourceButton.disabled) return;
    copyStatus.textContent = `${resourceButton.dataset.downloadResource} download will be attached to the purchased adventure package.`;
  });

  toggleMode.addEventListener('click', () => {
    const firstSubscriptionAdventure = adventures.find((adventure) => !adventureIsOwned(adventure) && adventureCanPlay(adventure));
    selectedAdventure = firstSubscriptionAdventure || adventures[0];
    renderSelectedAdventure();
  });

  initializeAdventureAuth();
  renderSelectedAdventure();
}
