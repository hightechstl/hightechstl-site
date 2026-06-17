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
      kit: {
        theme: 'archive',
        mapTitle: 'Gilded Archive map',
        mapDesc: 'An old archive floor plan with a reading room, restricted stacks, vault antechamber, hidden passage, clue desk, and curator office.',
        palette: {paper: '#efe1bd', grid: '#c4a873', stroke: '#6f5631', room: '#ddc994', route: '#0d7774', accent: '#bf6b35'},
        rooms: [
          [74, 82, 158, 92, 'Reading Room'],
          [278, 62, 188, 116, 'Vault Antechamber'],
          [116, 238, 178, 92, 'Hidden Passage'],
          [348, 248, 126, 106, 'Clue Desk'],
          [86, 354, 170, 38, 'Restricted Stacks'],
          [414, 66, 88, 62, 'Curator Office']
        ],
        routes: ['M232 128h46', 'M256 284h92', 'M412 178v70', 'M294 284c36-32 72-30 108 0'],
        tokens: [
          {x: 146, y: 142, color: '#bf6b35', label: 'A'},
          {x: 406, y: 304, color: '#0d7774', label: 'B'}
        ],
        clues: [
          {x: 438, y: 122, type: 'star'},
          {x: 188, y: 370, type: 'seal'},
          {x: 386, y: 282, type: 'key'}
        ],
        cards: ['Opening clue', 'Choice point', 'Final reveal'],
        resources: {
          MAP: ['Archive floor map', 'Reading room, vault, stacks, passage'],
          TOK: ['Archivist tokens', 'Scholar and locksmith cutouts'],
          STY: ['Three-act storyboard', 'Private prompts and shared reveals'],
          CLU: ['Cipher clue deck', 'Marginalia, keys, seals, ledger slips']
        }
      },
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
      kit: {
        theme: 'meridian',
        mapTitle: 'Meridian Roof map',
        mapDesc: 'A sci-fi rooftop route with relay towers, skylights, antenna bridges, maintenance hatch, signal dish, and drone patrol arcs.',
        palette: {paper: '#dceaf0', grid: '#8fb7c6', stroke: '#254a59', room: '#b8d4dc', route: '#e7833d', accent: '#0a6f89'},
        rooms: [
          [58, 80, 132, 84, 'Service Lift'],
          [236, 42, 142, 102, 'Relay Tower'],
          [418, 86, 92, 156, 'Skybridge'],
          [112, 240, 168, 104, 'Solar Array'],
          [332, 276, 176, 80, 'Signal Dish'],
          [74, 360, 116, 36, 'Hatch']
        ],
        routes: ['M190 122h46', 'M378 96h40', 'M464 242v34', 'M280 292h52', 'M160 344c42-44 92-56 150-36'],
        tokens: [
          {x: 118, y: 126, color: '#0a6f89', label: 'E'},
          {x: 432, y: 318, color: '#e7833d', label: 'R'}
        ],
        clues: [
          {x: 304, y: 82, type: 'signal'},
          {x: 462, y: 164, type: 'drone'},
          {x: 174, y: 284, type: 'panel'}
        ],
        cards: ['Power reroute', 'Signal cipher', 'Broadcast choice'],
        resources: {
          MAP: ['Rooftop route map', 'Relay tower, hatch, solar path, dish'],
          TOK: ['Engineer tokens', 'Rigger and codebreaker markers'],
          STY: ['Transmission board', 'Timed repair beats and split tasks'],
          CLU: ['Signal card deck', 'Frequency strips and rooftop markers']
        }
      },
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
      kit: {
        theme: 'foxglove',
        mapTitle: 'Foxglove grove map',
        mapDesc: 'A moonlit folklore grove with lantern trail, creek crossings, standing stones, foxglove ring, moon dial, and hidden root door.',
        palette: {paper: '#e5dfbc', grid: '#aebc89', stroke: '#4f6239', room: '#cbd79c', route: '#d48b31', accent: '#6b4a91'},
        rooms: [
          [78, 72, 118, 92, 'Gate Path'],
          [246, 82, 148, 92, 'Lantern Trail'],
          [438, 92, 78, 148, 'Creek'],
          [122, 248, 154, 102, 'Foxglove Ring'],
          [332, 260, 134, 104, 'Moon Dial'],
          [64, 360, 178, 36, 'Root Door']
        ],
        routes: ['M196 118c34-28 54-24 50 10', 'M394 128h44', 'M276 300h56', 'M184 350c72-46 150-38 210 10'],
        tokens: [
          {x: 144, y: 118, color: '#6b4a91', label: 'L'},
          {x: 390, y: 312, color: '#d48b31', label: 'M'}
        ],
        clues: [
          {x: 316, y: 124, type: 'lantern'},
          {x: 206, y: 292, type: 'flower'},
          {x: 396, y: 294, type: 'moon'}
        ],
        cards: ['Lantern omen', 'Vow exchange', 'Pact ending'],
        resources: {
          MAP: ['Grove trail map', 'Lantern path, crossings, moon dial'],
          TOK: ['Folklore tokens', 'Lantern keeper and vowbound traveler'],
          STY: ['Omen storyboard', 'Moon clock, vows, and final pact'],
          CLU: ['Omen card deck', 'Pressed flowers, crossings, whispered vows']
        }
      },
      beats: [
        'Follow the lantern trail and mark safe crossings on the shared grove map.',
        'Trade whispered vows and omen cards before the moon dial reaches midnight.',
        'Resolve the pact with a final two-player choice.'
      ]
    },
    {
      id: 'lanterns-below-marrow-hill',
      title: 'Lanterns Below Marrow Hill',
      type: 'Mystery / Light Fantasy',
      time: '55 min',
      purchased: false,
      invite: 'https://hightechstl.com/play/lanterns-below-marrow-hill?seat=2',
      summary: 'Two companions enter an old hill shrine to recover a vanished village lantern before the road goes dark for good.',
      kit: {
        theme: 'hill-lantern',
        mapTitle: 'Marrow Hill Shrine',
        mapDesc: 'A compact underground shrine with six connected areas: entry stair, candle hall, oath room, mirror pool, root vault, and lantern heart. The right side is reserved for story cards.',
        palette: {paper: '#F6EEDC', grid: '#D7C8A6', stroke: '#3D3428', room: '#E8D6AA', route: '#7A5C32', accent: '#D9822B'},
        rooms: [
          [48, 64, 130, 76, 'Entry Stair'],
          [220, 58, 150, 88, 'Candle Hall'],
          [402, 72, 104, 74, 'Oath Room'],
          [82, 230, 132, 86, 'Mirror Pool'],
          [260, 218, 138, 92, 'Root Vault'],
          [418, 268, 94, 88, 'Lantern Heart']
        ],
        routes: ['M178 102h42', 'M370 102h32', 'M142 140v90', 'M214 272h46', 'M398 264h20'],
        tokens: [
          {x: 112, y: 102, color: '#2F5D62', label: 'A'},
          {x: 144, y: 102, color: '#8A3FFC', label: 'B'}
        ],
        clues: [
          {x: 300, y: 102, type: 'lantern'},
          {x: 454, y: 112, type: 'seal'},
          {x: 466, y: 312, type: 'key'}
        ],
        cards: [
          'The stair opens after both players name what they fear losing.',
          'Lantern symbols and oath carvings reveal different truths.',
          'Restore the road, free the keeper, or split the flame.'
        ],
        resources: {
          MAP: ['Marrow Hill Shrine Map', 'Six connected shrine areas and marked clue points'],
          TOK: ['Two Lantern Seeker Tokens', 'Color-coded cutouts for quick mobile reference'],
          STY: ['Lanterns Below Storyboard', 'Scene guide with timing and final outcomes'],
          CLU: ['Lantern, Seal, and Key Clue Deck', 'Split clues that encourage shared deduction']
        }
      },
      beats: [
        'Both players arrive at Marrow Hill as the village lantern flickers out and the sealed stair opens beneath it.',
        'Each player receives a different clue trail: one follows old lantern symbols while the other deciphers hidden vows carved into stone.',
        'Together, the players choose whether to restore the lantern’s light, free the spirit bound inside it, or split the power between both.'
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
      kit: {
        theme: 'ember',
        mapTitle: 'Ember House map',
        mapDesc: 'A cozy supper-club heist map with dining room tables, bar, kitchen pass, back office, coat check, and ledger route.',
        palette: {paper: '#f1d6aa', grid: '#c58d58', stroke: '#65351f', room: '#ddb26f', route: '#0e6f68', accent: '#b63f2b'},
        rooms: [
          [70, 78, 184, 124, 'Dining Room'],
          [302, 78, 172, 74, 'Bar'],
          [326, 190, 172, 70, 'Kitchen Pass'],
          [328, 298, 128, 70, 'Back Office'],
          [86, 276, 144, 84, 'Coat Check'],
          [78, 374, 184, 24, 'Service Hall']
        ],
        routes: ['M254 140h48', 'M412 152v38', 'M412 260v38', 'M230 318h98', 'M158 276c44-54 104-70 170-58'],
        tokens: [
          {x: 154, y: 138, color: '#b63f2b', label: 'D'},
          {x: 392, y: 334, color: '#0e6f68', label: 'S'}
        ],
        clues: [
          {x: 366, y: 116, type: 'glass'},
          {x: 424, y: 334, type: 'ledger'},
          {x: 146, y: 318, type: 'ticket'}
        ],
        cards: ['Cover story', 'Menu cipher', 'Ledger grab'],
        resources: {
          MAP: ['Supper-club floor map', 'Tables, bar, kitchen pass, office'],
          TOK: ['Heist role tokens', 'Decoy and safecracker table markers'],
          STY: ['Heist storyboard', 'Cover stories, distractions, final choice'],
          CLU: ['Menu clue deck', 'Receipts, coat checks, ledger fragments']
        }
      },
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
  const mapBoard = adventureApp.querySelector('[data-map-board]');
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
  const loginForm = document.querySelector('[data-adventure-login-form]');
  const loginMessage = document.querySelector('[data-login-message]');
  const loginButton = document.querySelector('[data-login-button]');
  const createAccountButton = document.querySelector('[data-create-account]');
  const resetPasswordButton = document.querySelector('[data-reset-password]');
  const accountPanel = document.querySelector('[data-adventure-account]');
  const accountTitle = document.querySelector('[data-account-title]');
  const signedInEmail = document.querySelector('[data-signed-in-email]');
  const signOutButton = document.querySelector('[data-sign-out]');
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

  const shapeForClue = (clue, palette) => {
    const fill = escapeHtml(palette.accent);
    if (clue.type === 'star') return `<path d="M${clue.x} ${clue.y - 24}l12 20 23 5-16 17 3 23-22-9-22 9 3-23-16-17 23-5z" fill="${fill}"/>`;
    if (clue.type === 'seal') return `<circle cx="${clue.x}" cy="${clue.y}" r="15" fill="${fill}"/><circle cx="${clue.x}" cy="${clue.y}" r="8" fill="none" stroke="#fff6dc" stroke-width="3"/>`;
    if (clue.type === 'key') return `<circle cx="${clue.x}" cy="${clue.y}" r="10" fill="none" stroke="${fill}" stroke-width="6"/><path d="M${clue.x + 10} ${clue.y}h32m-9 0v12m10-12v9" stroke="${fill}" stroke-width="6" stroke-linecap="round"/>`;
    if (clue.type === 'signal') return `<path d="M${clue.x - 26} ${clue.y + 20}c18-28 34-28 52 0M${clue.x - 14} ${clue.y + 10}c10-14 18-14 28 0" fill="none" stroke="${fill}" stroke-width="6" stroke-linecap="round"/><circle cx="${clue.x}" cy="${clue.y + 24}" r="6" fill="${fill}"/>`;
    if (clue.type === 'drone') return `<rect x="${clue.x - 16}" y="${clue.y - 10}" width="32" height="20" rx="6" fill="${fill}"/><circle cx="${clue.x - 30}" cy="${clue.y}" r="10" fill="none" stroke="${fill}" stroke-width="5"/><circle cx="${clue.x + 30}" cy="${clue.y}" r="10" fill="none" stroke="${fill}" stroke-width="5"/>`;
    if (clue.type === 'panel') return `<rect x="${clue.x - 22}" y="${clue.y - 16}" width="44" height="32" rx="4" fill="${fill}"/><path d="M${clue.x - 12} ${clue.y - 2}h24M${clue.x - 12} ${clue.y + 8}h16" stroke="#fff6dc" stroke-width="4" stroke-linecap="round"/>`;
    if (clue.type === 'lantern') return `<path d="M${clue.x - 14} ${clue.y - 4}h28l-5 36h-18z" fill="${fill}"/><path d="M${clue.x - 10} ${clue.y - 4}c0-18 20-18 20 0" fill="none" stroke="${fill}" stroke-width="5"/><circle cx="${clue.x}" cy="${clue.y + 13}" r="7" fill="#ffe7a8"/>`;
    if (clue.type === 'flower') return `<g fill="${fill}"><circle cx="${clue.x}" cy="${clue.y - 15}" r="10"/><circle cx="${clue.x + 14}" cy="${clue.y}" r="10"/><circle cx="${clue.x}" cy="${clue.y + 15}" r="10"/><circle cx="${clue.x - 14}" cy="${clue.y}" r="10"/></g><circle cx="${clue.x}" cy="${clue.y}" r="6" fill="#f4d27d"/>`;
    if (clue.type === 'moon') return `<path d="M${clue.x + 18} ${clue.y - 26}a28 28 0 1 0 0 52 22 22 0 1 1 0-52z" fill="${fill}"/>`;
    if (clue.type === 'glass') return `<path d="M${clue.x - 16} ${clue.y - 22}h32l-7 28a9 9 0 0 1-18 0zM${clue.x} ${clue.y + 8}v22m-16 0h32" fill="none" stroke="${fill}" stroke-width="6" stroke-linecap="round"/>`;
    if (clue.type === 'ledger') return `<rect x="${clue.x - 22}" y="${clue.y - 26}" width="44" height="52" rx="5" fill="${fill}"/><path d="M${clue.x - 10} ${clue.y - 10}h20M${clue.x - 10} ${clue.y + 3}h18M${clue.x - 10} ${clue.y + 16}h14" stroke="#fff6dc" stroke-width="4" stroke-linecap="round"/>`;
    return `<path d="M${clue.x - 20} ${clue.y - 14}h40v28h-40z" fill="${fill}"/><path d="M${clue.x - 12} ${clue.y}h24" stroke="#fff6dc" stroke-width="4" stroke-linecap="round"/>`;
  };

  const cardTextLines = (text, maxLength = 19, maxLines = 3) => {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];

    words.forEach((word) => {
      if (lines.length === 0) {
        lines.push(word);
        return;
      }

      const current = lines[lines.length - 1] || '';
      const next = current ? `${current} ${word}` : word;
      if (next.length <= maxLength) {
        lines[lines.length - 1] = next;
      } else if (lines.length < maxLines) {
        lines.push(word);
      } else {
        lines[lines.length - 1] = `${current.replace(/\.+$/, '')}...`;
      }
    });

    return lines.slice(0, maxLines);
  };

  const renderMapBoard = () => {
    const kit = selectedAdventure.kit;
    const palette = kit.palette;
    const rooms = kit.rooms.map(([x, y, width, height, label]) => `
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="${escapeHtml(palette.room)}" stroke="${escapeHtml(palette.stroke)}" stroke-width="3"/>
      <text x="${x + 14}" y="${y + Math.min(34, height / 2 + 6)}" fill="#473520" font-size="15" font-family="Inter, Arial, sans-serif" font-weight="850">${escapeHtml(label)}</text>
    `).join('');
    const routes = kit.routes.map((path) => `<path d="${escapeHtml(path)}" fill="none" stroke="${escapeHtml(palette.route)}" stroke-width="7" stroke-linecap="round" stroke-dasharray="13 10"/>`).join('');
    const tokens = kit.tokens.map((token) => `
      <circle cx="${token.x}" cy="${token.y}" r="17" fill="${escapeHtml(token.color)}" stroke="#fff6dc" stroke-width="4"/>
      <text x="${token.x}" y="${token.y + 6}" text-anchor="middle" fill="#fff6dc" font-size="15" font-family="Inter, Arial, sans-serif" font-weight="900">${escapeHtml(token.label)}</text>
    `).join('');
    const clues = kit.clues.map((clue) => shapeForClue(clue, palette)).join('');
    const cards = kit.cards.map((card, index) => {
      const y = 36 + index * 108;
      const dotColor = index % 2 === 0 ? palette.route : palette.accent;
      const lines = cardTextLines(card);
      const textLines = lines.map((line, lineIndex) => (
        `<tspan x="24" dy="${lineIndex === 0 ? 0 : 16}">${escapeHtml(line)}</tspan>`
      )).join('');
      return `
        <rect y="${y}" width="164" height="82" rx="10" fill="#fff7e5" stroke="${escapeHtml(palette.stroke)}" stroke-width="2"/>
        <circle cx="28" cy="${y + 22}" r="7" fill="${escapeHtml(dotColor)}"/>
        <path d="M24 ${y + 40}h116" stroke="${escapeHtml(palette.accent)}" stroke-width="8" stroke-linecap="round"/>
        <text x="24" y="${y + 56}" fill="#473520" font-size="12" font-family="Inter, Arial, sans-serif" font-weight="850">${textLines}</text>
      `;
    }).join('');

    mapBoard.innerHTML = `
      <svg class="adventure-kit-svg ${escapeHtml(kit.theme)}" viewBox="0 0 760 430" role="img" aria-labelledby="map-title map-desc">
        <title id="map-title">${escapeHtml(kit.mapTitle)}</title>
        <desc id="map-desc">${escapeHtml(kit.mapDesc)}</desc>
        <defs>
          <pattern id="map-grid-${escapeHtml(kit.theme)}" width="38" height="38" patternUnits="userSpaceOnUse">
            <path d="M38 0H0v38" fill="none" stroke="${escapeHtml(palette.grid)}" stroke-width="1" opacity=".45"/>
          </pattern>
        </defs>
        <rect width="760" height="430" rx="18" fill="${escapeHtml(palette.paper)}"/>
        <rect x="28" y="28" width="504" height="374" rx="12" fill="url(#map-grid-${escapeHtml(kit.theme)})" stroke="${escapeHtml(palette.stroke)}" stroke-width="3"/>
        ${rooms}
        ${routes}
        ${clues}
        ${tokens}
        <g transform="translate(562 0)">${cards}</g>
      </svg>
    `;
  };

  const renderResources = () => {
    const unlocked = adventureIsOwned(selectedAdventure);
    const kitResources = selectedAdventure.kit.resources;
    resourceList.innerHTML = resources.map(([icon, name, detail]) => `
      <div class="resource-item ${unlocked ? 'unlocked' : ''}">
        <span class="resource-icon">${escapeHtml(icon)}</span>
        <div><strong>${escapeHtml(kitResources[icon]?.[0] || name)}</strong><span>${escapeHtml(kitResources[icon]?.[1] || detail)}</span></div>
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
    renderMapBoard();
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
