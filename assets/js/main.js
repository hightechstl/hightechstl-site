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

  const resources = [
    ['MAP', 'Adventure map', 'Printable table map'],
    ['TOK', 'Player tokens', 'Cutout token sheet'],
    ['STY', 'Storyboard', 'Scene-by-scene guide'],
    ['CLU', 'Clue deck', 'Private prompt cards']
  ];

  let selectedAdventure = adventures[0];

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

  const renderAdventureList = () => {
    list.innerHTML = adventures.map((adventure) => `
      <button class="adventure-choice" type="button" data-adventure-id="${adventure.id}" aria-selected="${adventure.id === selectedAdventure.id}">
        <strong>${adventure.title}</strong>
        <span><em>${adventure.type}</em><b>${adventure.purchased ? 'Owned' : 'Subscription'}</b></span>
      </button>
    `).join('');
    modeLabel.textContent = `${adventures.filter((adventure) => adventure.purchased).length} purchased`;
  };

  const renderResources = () => {
    const unlocked = selectedAdventure.purchased;
    resourceList.innerHTML = resources.map(([icon, name, detail]) => `
      <div class="resource-item ${unlocked ? 'unlocked' : ''}">
        <span class="resource-icon">${icon}</span>
        <div><strong>${name}</strong><span>${detail}</span></div>
        <span class="resource-state">${unlocked ? 'Download' : 'Locked'}</span>
      </div>
    `).join('');
  };

  const renderSelectedAdventure = () => {
    title.textContent = selectedAdventure.title;
    type.textContent = selectedAdventure.type;
    time.textContent = selectedAdventure.time;
    accessTitle.textContent = selectedAdventure.purchased ? 'Purchased' : 'Subscribed';
    accessCopy.textContent = selectedAdventure.summary;
    accessLight.classList.toggle('unlocked', selectedAdventure.purchased);
    inviteInput.value = selectedAdventure.invite;
    storyOne.textContent = selectedAdventure.beats[0];
    storyTwo.textContent = selectedAdventure.beats[1];
    storyThree.textContent = selectedAdventure.beats[2];
    purchaseButton.textContent = selectedAdventure.purchased ? 'Permanent Access Active' : 'Buy Permanent Access';
    purchaseButton.disabled = selectedAdventure.purchased;
    copyStatus.textContent = 'Ready for player two.';
    renderAdventureList();
    renderResources();
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
    selectedAdventure.purchased = true;
    selectedAdventure.summary = 'Permanent access is now active. Downloads and replay access are unlocked.';
    renderSelectedAdventure();
  });

  startButton.addEventListener('click', () => {
    copyStatus.textContent = `Starting ${selectedAdventure.title}.`;
  });

  toggleMode.addEventListener('click', () => {
    const firstSubscriptionAdventure = adventures.find((adventure) => !adventure.purchased);
    selectedAdventure = firstSubscriptionAdventure || adventures[0];
    renderSelectedAdventure();
  });

  renderSelectedAdventure();
}
