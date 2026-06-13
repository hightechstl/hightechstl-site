(() => {
  const config = window.HIGH_TECH_STL_FIREBASE_CONFIG;
  const configReady = config && config.apiKey && !config.apiKey.includes('REPLACE_ME');

  const elements = Object.fromEntries(
    [...document.querySelectorAll('[id]')].map((element) => [element.id, element])
  );

  if (!configReady) {
    elements['login-message'].textContent =
      'Firebase is not configured yet. See docs/service-desk-setup.md.';
    elements['login-form'].querySelector('button').disabled = true;
    return;
  }

  firebase.initializeApp(config);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;

  let currentUser = null;
  let clients = [];
  let tickets = [];
  let unsubClients = null;
  let unsubTickets = null;
  let unsubActivity = null;

  const statusLabels = {
    new: 'New',
    open: 'Open',
    in_progress: 'In progress',
    waiting_client: 'Waiting on client',
    resolved: 'Resolved',
    closed: 'Closed'
  };

  const priorityLabels = {
    urgent: 'Urgent',
    high: 'High',
    normal: 'Normal',
    low: 'Low'
  };

  const viewMeta = {
    dashboard: ['Service desk', 'Overview'],
    tickets: ['Support operations', 'Tickets'],
    clients: ['Account records', 'Clients']
  };

  const normalize = (value) => String(value || '').trim().toLowerCase();
  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function formatDate(value, includeTime = false) {
    const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Not set';
    return new Intl.DateTimeFormat('en-US', includeTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'medium' }).format(date);
  }

  function showMessage(message, isError = false) {
    elements['app-message'].textContent = message;
    elements['app-message'].classList.toggle('error', isError);
    elements['app-message'].hidden = false;
    window.setTimeout(() => {
      elements['app-message'].hidden = true;
    }, 5000);
  }

  function readableError(error) {
    console.error(error);
    if (error?.code === 'permission-denied') return 'You do not have permission to perform that action.';
    if (error?.code === 'auth/invalid-credential') return 'The email or password is incorrect.';
    if (error?.code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment and try again.';
    return error?.message || 'Something went wrong. Please try again.';
  }

  function setView(viewName) {
    document.querySelectorAll('.admin-view').forEach((view) => {
      view.hidden = view.id !== `${viewName}-view`;
    });
    document.querySelectorAll('[data-view]').forEach((button) => {
      button.classList.toggle('active', button.dataset.view === viewName);
    });
    const [eyebrow, title] = viewMeta[viewName];
    elements['view-eyebrow'].textContent = eyebrow;
    elements['view-title'].textContent = title;
  }

  function clientById(id) {
    return clients.find((client) => client.id === id);
  }

  function renderClientOptions(selectedId = '') {
    const options = clients
      .filter((client) => client.status !== 'inactive' || client.id === selectedId)
      .sort((a, b) => a.company.localeCompare(b.company))
      .map((client) => `<option value="${escapeHtml(client.id)}"${client.id === selectedId ? ' selected' : ''}>${escapeHtml(client.company)}</option>`)
      .join('');
    elements['ticket-client'].innerHTML = `<option value="">Select a client</option>${options}`;
  }

  function ticketRow(ticket) {
    const client = clientById(ticket.clientId);
    return `
      <article class="admin-list-item" data-ticket-id="${escapeHtml(ticket.id)}" tabindex="0">
        <div>
          <h3>${escapeHtml(ticket.title)}</h3>
          <p>${escapeHtml(client?.company || ticket.clientName || 'Unknown client')} · ${escapeHtml(ticket.category || 'General support')} · Updated ${escapeHtml(formatDate(ticket.updatedAt, true))}</p>
        </div>
        <div class="admin-list-actions">
          <span class="admin-badge ${escapeHtml(ticket.priority)}">${escapeHtml(priorityLabels[ticket.priority] || ticket.priority)}</span>
          <span class="admin-badge ${escapeHtml(ticket.status)}">${escapeHtml(statusLabels[ticket.status] || ticket.status)}</span>
          <button class="admin-link-button" type="button" data-edit-ticket="${escapeHtml(ticket.id)}">Edit</button>
        </div>
      </article>`;
  }

  function clientRow(client) {
    const openCount = tickets.filter((ticket) => ticket.clientId === client.id && !['resolved', 'closed'].includes(ticket.status)).length;
    return `
      <article class="admin-list-item" data-client-id="${escapeHtml(client.id)}" tabindex="0">
        <div>
          <h3>${escapeHtml(client.company)}</h3>
          <p>${escapeHtml(client.primaryContact || 'No contact')} · ${escapeHtml(client.email || client.phone || 'No contact details')} · ${openCount} open ticket${openCount === 1 ? '' : 's'}</p>
        </div>
        <div class="admin-list-actions">
          <span class="admin-badge ${escapeHtml(client.status)}">${escapeHtml(client.status || 'lead')}</span>
          <button class="admin-link-button" type="button" data-new-ticket-client="${escapeHtml(client.id)}">New ticket</button>
          <button class="admin-link-button" type="button" data-edit-client="${escapeHtml(client.id)}">Edit</button>
        </div>
      </article>`;
  }

  function renderDashboard() {
    const openTickets = tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status));
    elements['metric-open'].textContent = openTickets.length;
    elements['metric-priority'].textContent = openTickets.filter((ticket) => ['urgent', 'high'].includes(ticket.priority)).length;
    elements['metric-waiting'].textContent = openTickets.filter((ticket) => ticket.status === 'waiting_client').length;
    elements['metric-clients'].textContent = clients.filter((client) => client.status === 'active').length;

    const recentTickets = tickets.slice(0, 6);
    elements['recent-ticket-list'].innerHTML = recentTickets.length
      ? recentTickets.map(ticketRow).join('')
      : '<p class="admin-empty">No tickets yet.</p>';

    const recentClients = [...clients]
      .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
      .slice(0, 6);
    elements['recent-client-list'].innerHTML = recentClients.length
      ? recentClients.map(clientRow).join('')
      : '<p class="admin-empty">No clients yet.</p>';
  }

  function renderTickets() {
    const search = normalize(elements['ticket-search'].value);
    const status = elements['ticket-status-filter'].value;
    const priority = elements['ticket-priority-filter'].value;
    const filtered = tickets.filter((ticket) => {
      const client = clientById(ticket.clientId);
      const haystack = normalize([ticket.title, ticket.description, ticket.reportedBy, ticket.category, client?.company].join(' '));
      return (!search || haystack.includes(search)) && (!status || ticket.status === status) && (!priority || ticket.priority === priority);
    });
    elements['ticket-list'].innerHTML = filtered.length
      ? filtered.map(ticketRow).join('')
      : '<p class="admin-empty">No tickets match these filters.</p>';
  }

  function renderClients() {
    const search = normalize(elements['client-search'].value);
    const filtered = clients.filter((client) => normalize([
      client.company, client.primaryContact, client.email, client.phone, client.servicePlan, client.address
    ].join(' ')).includes(search));
    elements['client-list'].innerHTML = filtered.length
      ? filtered.map(clientRow).join('')
      : '<p class="admin-empty">No clients match this search.</p>';
  }

  function renderAll() {
    renderClientOptions(elements['ticket-client'].value);
    renderDashboard();
    renderTickets();
    renderClients();
  }

  function openClientDialog(client = null) {
    elements['client-form'].reset();
    elements['client-id'].value = client?.id || '';
    elements['client-dialog-title'].textContent = client ? 'Edit Client' : 'New Client';
    elements['client-company'].value = client?.company || '';
    elements['client-status'].value = client?.status || 'lead';
    elements['client-contact'].value = client?.primaryContact || '';
    elements['client-email'].value = client?.email || '';
    elements['client-phone'].value = client?.phone || '';
    elements['client-plan'].value = client?.servicePlan || '';
    elements['client-address'].value = client?.address || '';
    elements['client-notes'].value = client?.notes || '';
    elements['client-dialog'].showModal();
  }

  function openTicketDialog(ticket = null, clientId = '') {
    if (!ticket && clients.length === 0) {
      showMessage('Create a client before opening a trouble ticket.', true);
      openClientDialog();
      return;
    }
    elements['ticket-form'].reset();
    elements['ticket-id'].value = ticket?.id || '';
    elements['ticket-dialog-title'].textContent = ticket ? 'Edit Ticket' : 'New Ticket';
    elements['ticket-title'].value = ticket?.title || '';
    renderClientOptions(ticket?.clientId || clientId);
    elements['ticket-client'].value = ticket?.clientId || clientId || '';
    elements['ticket-contact'].value = ticket?.reportedBy || clientById(clientId)?.primaryContact || '';
    elements['ticket-status'].value = ticket?.status || 'new';
    elements['ticket-priority'].value = ticket?.priority || 'normal';
    elements['ticket-category'].value = ticket?.category || 'General support';
    elements['ticket-due'].value = ticket?.dueDate || '';
    elements['ticket-description'].value = ticket?.description || '';
    elements['ticket-dialog'].showModal();
  }

  async function openTicketDetail(ticketId) {
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket) return;
    const client = clientById(ticket.clientId);
    elements['detail-title'].textContent = ticket.title;
    elements['activity-ticket-id'].value = ticket.id;
    elements['ticket-detail-content'].innerHTML = `
      <div class="admin-list-actions"><span class="admin-badge ${escapeHtml(ticket.priority)}">${escapeHtml(priorityLabels[ticket.priority])}</span><span class="admin-badge ${escapeHtml(ticket.status)}">${escapeHtml(statusLabels[ticket.status])}</span><button class="admin-link-button" type="button" data-edit-ticket="${escapeHtml(ticket.id)}">Edit ticket</button></div>
      <div class="admin-detail-grid">
        <div><strong>Client</strong>${escapeHtml(client?.company || ticket.clientName || 'Unknown')}</div>
        <div><strong>Reported by</strong>${escapeHtml(ticket.reportedBy || 'Not recorded')}</div>
        <div><strong>Category</strong>${escapeHtml(ticket.category || 'General support')}</div>
        <div><strong>Target date</strong>${escapeHtml(ticket.dueDate ? formatDate(`${ticket.dueDate}T12:00:00`) : 'Not set')}</div>
        <div><strong>Created</strong>${escapeHtml(formatDate(ticket.createdAt, true))}</div>
        <div><strong>Updated</strong>${escapeHtml(formatDate(ticket.updatedAt, true))}</div>
      </div>
      <h3>Issue</h3><div class="admin-detail-description">${escapeHtml(ticket.description)}</div>`;
    elements['activity-note'].value = '';
    elements['activity-list'].innerHTML = '<p class="admin-empty">Loading activity...</p>';
    elements['ticket-detail-dialog'].showModal();

    if (unsubActivity) unsubActivity();
    unsubActivity = db.collection('tickets').doc(ticket.id).collection('activity')
      .orderBy('createdAt', 'desc')
      .onSnapshot((snapshot) => {
        const entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        elements['activity-list'].innerHTML = entries.length
          ? entries.map((entry) => `<article class="admin-timeline-item"><p>${escapeHtml(entry.note)}</p><small>${escapeHtml(entry.authorEmail || 'Administrator')} · ${escapeHtml(formatDate(entry.createdAt, true))}</small></article>`).join('')
          : '<p class="admin-empty">No activity notes yet.</p>';
      }, (error) => showMessage(readableError(error), true));
  }

  async function saveClient(event) {
    event.preventDefault();
    const id = elements['client-id'].value;
    const data = {
      company: elements['client-company'].value.trim(),
      status: elements['client-status'].value,
      primaryContact: elements['client-contact'].value.trim(),
      email: elements['client-email'].value.trim(),
      phone: elements['client-phone'].value.trim(),
      servicePlan: elements['client-plan'].value.trim(),
      address: elements['client-address'].value.trim(),
      notes: elements['client-notes'].value.trim(),
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.email
    };

    try {
      if (id) {
        await db.collection('clients').doc(id).update(data);
      } else {
        await db.collection('clients').add({ ...data, createdAt: serverTimestamp(), createdBy: currentUser.email });
      }
      elements['client-dialog'].close();
      showMessage(id ? 'Client updated.' : 'Client created.');
    } catch (error) {
      showMessage(readableError(error), true);
    }
  }

  async function saveTicket(event) {
    event.preventDefault();
    const id = elements['ticket-id'].value;
    const existing = tickets.find((ticket) => ticket.id === id);
    const selectedClient = clientById(elements['ticket-client'].value);
    const data = {
      title: elements['ticket-title'].value.trim(),
      clientId: elements['ticket-client'].value,
      clientName: selectedClient?.company || '',
      reportedBy: elements['ticket-contact'].value.trim(),
      status: elements['ticket-status'].value,
      priority: elements['ticket-priority'].value,
      category: elements['ticket-category'].value,
      dueDate: elements['ticket-due'].value,
      description: elements['ticket-description'].value.trim(),
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.email
    };

    try {
      let ticketRef;
      if (id) {
        ticketRef = db.collection('tickets').doc(id);
        await ticketRef.update(data);
      } else {
        ticketRef = await db.collection('tickets').add({ ...data, createdAt: serverTimestamp(), createdBy: currentUser.email });
      }

      const changes = [];
      if (!existing) changes.push('Ticket created.');
      if (existing && existing.status !== data.status) changes.push(`Status changed from ${statusLabels[existing.status]} to ${statusLabels[data.status]}.`);
      if (existing && existing.priority !== data.priority) changes.push(`Priority changed from ${priorityLabels[existing.priority]} to ${priorityLabels[data.priority]}.`);
      if (changes.length) {
        await ticketRef.collection('activity').add({
          note: changes.join(' '),
          type: 'system',
          authorEmail: currentUser.email,
          createdAt: serverTimestamp()
        });
      }

      elements['ticket-dialog'].close();
      showMessage(id ? 'Ticket updated.' : 'Ticket created.');
    } catch (error) {
      showMessage(readableError(error), true);
    }
  }

  async function addActivity(event) {
    event.preventDefault();
    const ticketId = elements['activity-ticket-id'].value;
    const note = elements['activity-note'].value.trim();
    if (!ticketId || !note) return;
    try {
      await db.collection('tickets').doc(ticketId).collection('activity').add({
        note,
        type: 'note',
        authorEmail: currentUser.email,
        createdAt: serverTimestamp()
      });
      await db.collection('tickets').doc(ticketId).update({
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.email
      });
      elements['activity-note'].value = '';
    } catch (error) {
      showMessage(readableError(error), true);
    }
  }

  function subscribeToData() {
    unsubClients = db.collection('clients').orderBy('company').onSnapshot((snapshot) => {
      clients = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderAll();
    }, (error) => showMessage(readableError(error), true));

    unsubTickets = db.collection('tickets').orderBy('updatedAt', 'desc').onSnapshot((snapshot) => {
      tickets = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderAll();
    }, (error) => showMessage(readableError(error), true));
  }

  function stopSubscriptions() {
    [unsubClients, unsubTickets, unsubActivity].forEach((unsubscribe) => unsubscribe?.());
    unsubClients = unsubTickets = unsubActivity = null;
  }

  elements['login-form'].addEventListener('submit', async (event) => {
    event.preventDefault();
    elements['login-message'].textContent = 'Signing in...';
    try {
      await auth.signInWithEmailAndPassword(
        elements['login-email'].value.trim(),
        elements['login-password'].value
      );
    } catch (error) {
      elements['login-message'].textContent = readableError(error);
    }
  });

  auth.onAuthStateChanged(async (user) => {
    stopSubscriptions();
    currentUser = null;
    if (!user) {
      elements['app-view'].hidden = true;
      elements['login-view'].hidden = false;
      elements['login-message'].textContent = '';
      return;
    }

    try {
      const adminSnapshot = await db.collection('admins').doc(user.uid).get();
      if (!adminSnapshot.exists || adminSnapshot.data()?.active !== true) {
        await auth.signOut();
        elements['login-message'].textContent = 'This account is not authorized for the service desk.';
        return;
      }
      currentUser = user;
      elements['signed-in-email'].textContent = user.email || user.uid;
      elements['login-form'].reset();
      elements['login-message'].textContent = '';
      elements['login-view'].hidden = true;
      elements['app-view'].hidden = false;
      setView('dashboard');
      subscribeToData();
    } catch (error) {
      await auth.signOut();
      elements['login-message'].textContent = readableError(error);
    }
  });

  elements['sign-out-button'].addEventListener('click', () => auth.signOut());
  elements['new-client-button'].addEventListener('click', () => openClientDialog());
  elements['new-ticket-button'].addEventListener('click', () => openTicketDialog());
  elements['client-form'].addEventListener('submit', saveClient);
  elements['ticket-form'].addEventListener('submit', saveTicket);
  elements['activity-form'].addEventListener('submit', addActivity);

  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
  document.querySelectorAll('[data-go-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.goView)));
  document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => elements[button.dataset.closeDialog].close()));
  ['ticket-search', 'ticket-status-filter', 'ticket-priority-filter'].forEach((id) => elements[id].addEventListener('input', renderTickets));
  elements['client-search'].addEventListener('input', renderClients);

  document.addEventListener('click', (event) => {
    const editClient = event.target.closest('[data-edit-client]');
    const editTicket = event.target.closest('[data-edit-ticket]');
    const newTicket = event.target.closest('[data-new-ticket-client]');
    const ticketRowElement = event.target.closest('[data-ticket-id]');
    const clientRowElement = event.target.closest('[data-client-id]');

    if (editClient) {
      event.stopPropagation();
      openClientDialog(clientById(editClient.dataset.editClient));
    } else if (editTicket) {
      event.stopPropagation();
      if (elements['ticket-detail-dialog'].open) {
        elements['ticket-detail-dialog'].close();
      }
      openTicketDialog(tickets.find((ticket) => ticket.id === editTicket.dataset.editTicket));
    } else if (newTicket) {
      event.stopPropagation();
      openTicketDialog(null, newTicket.dataset.newTicketClient);
    } else if (ticketRowElement) {
      openTicketDetail(ticketRowElement.dataset.ticketId);
    } else if (clientRowElement) {
      openClientDialog(clientById(clientRowElement.dataset.clientId));
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const ticketRowElement = event.target.closest('[data-ticket-id]');
    const clientRowElement = event.target.closest('[data-client-id]');
    if (ticketRowElement) openTicketDetail(ticketRowElement.dataset.ticketId);
    if (clientRowElement) openClientDialog(clientById(clientRowElement.dataset.clientId));
  });

  elements['ticket-detail-dialog'].addEventListener('close', () => {
    unsubActivity?.();
    unsubActivity = null;
  });
})();
