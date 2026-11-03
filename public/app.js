const eventsElement = document.querySelector('#events');
const feedback = document.querySelector('#feedback');
const stateElement = document.querySelector('#reservation-state');
const controls = document.querySelector('#checkout-controls');
const checkoutButton = document.querySelector('#checkout');
let currentReservationId = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const body = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(body.error?.message || 'La demande n’a pas abouti.');
  return body;
}

function showFeedback(message = '') { feedback.textContent = message; }

function displayReservation(reservation) {
  currentReservationId = reservation.id;
  document.querySelector('#lookup-id').value = reservation.id;
  const labels = {
    PENDING: 'En attente de paiement',
    CONFIRMED: 'Achat confirmé',
    FAILED: 'Paiement refusé',
    EXPIRED: 'Réservation expirée',
  };
  stateElement.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = labels[reservation.status] || reservation.status;
  const id = document.createElement('span');
  id.className = 'reservation-id';
  id.textContent = `Référence : ${reservation.id}`;
  const detail = document.createElement('span');
  detail.textContent = reservation.status === 'PENDING'
    ? 'La place est retenue provisoirement. Une réponse lente ne confirme pas l’achat.'
    : reservation.status === 'CONFIRMED'
      ? 'Votre place est confirmée.'
      : 'Cette réservation ne retient plus de place.';
  stateElement.append(title, id, detail);
  controls.hidden = reservation.status !== 'PENDING';
}

async function loadEvents() {
  try {
    const { events } = await api('/api/events');
    eventsElement.replaceChildren();
    for (const event of events) {
      const card = document.createElement('article');
      card.className = 'event-card';
      const info = document.createElement('div');
      const date = document.createElement('p');
      date.className = 'event-date';
      date.textContent = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(event.startsAt));
      const title = document.createElement('h3');
      title.textContent = event.title;
      const venue = document.createElement('p');
      venue.className = 'event-place';
      venue.textContent = event.venue;
      const availability = document.createElement('p');
      availability.className = 'availability';
      availability.textContent = event.available > 0 ? `${event.available} place${event.available > 1 ? 's' : ''} affichée${event.available > 1 ? 's' : ''}` : 'Complet';
      info.append(date, title, venue, availability);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Réserver';
      button.disabled = event.available <= 0;
      button.addEventListener('click', () => reserve(event.id, button));
      card.append(info, button);
      eventsElement.append(card);
    }
  } catch (error) {
    eventsElement.textContent = 'Impossible de charger les événements.';
    showFeedback(error.message);
  }
}

async function reserve(eventId, button) {
  showFeedback();
  button.disabled = true;
  try {
    const customerRef = document.querySelector('#customer-ref').value.trim();
    const { reservation } = await api('/api/reservations', {
      method: 'POST', body: JSON.stringify({ eventId, customerRef }),
    });
    displayReservation(reservation);
    await loadEvents();
  } catch (error) { showFeedback(error.message); }
  finally { button.disabled = false; }
}

checkoutButton.addEventListener('click', async () => {
  if (!currentReservationId) return;
  checkoutButton.disabled = true;
  showFeedback();
  try {
    const scenario = document.querySelector('#scenario').value;
    const { reservation, paymentAttempt } = await api(`/api/reservations/${currentReservationId}/checkout`, {
      method: 'POST', body: JSON.stringify({ scenario }),
    });
    displayReservation(reservation);
    if (paymentAttempt.status === 'PENDING') showFeedback('Résultat du paiement inconnu : consultez de nouveau l’état avant de conclure.');
    await loadEvents();
  } catch (error) { showFeedback(error.message); }
  finally { checkoutButton.disabled = false; }
});

document.querySelector('#lookup-form').addEventListener('submit', async event => {
  event.preventDefault();
  showFeedback();
  const id = document.querySelector('#lookup-id').value.trim();
  if (!id) { showFeedback('Saisissez une référence de réservation.'); return; }
  try {
    const { reservation } = await api(`/api/reservations/${encodeURIComponent(id)}`);
    displayReservation(reservation);
    await loadEvents();
  } catch (error) { showFeedback(error.message); }
});

const accountState = document.querySelector('#account-state');
const accountFeedback = document.querySelector('#account-feedback');
const accountForm = document.querySelector('#account-form');
const loginButton = document.querySelector('#login');
const registerButton = document.querySelector('#register');
const logoutButton = document.querySelector('#logout');

function displayAccount(user) {
  accountState.textContent = user ? `Connecté : ${user.email}` : 'Non connecté.';
  accountForm.querySelectorAll('input').forEach(input => { input.hidden = !!user; input.previousElementSibling.hidden = !!user; });
  loginButton.hidden = !!user;
  registerButton.hidden = !!user;
  logoutButton.hidden = !user;
}

async function authenticate(path) {
  accountFeedback.textContent = '';
  const email = document.querySelector('#account-email').value;
  const password = document.querySelector('#account-password').value;
  try {
    const { user } = await api(path, { method: 'POST', body: JSON.stringify({ email, password }) });
    document.querySelector('#account-password').value = '';
    displayAccount(user);
  } catch (error) { accountFeedback.textContent = error.message; }
}

accountForm.addEventListener('submit', event => { event.preventDefault(); authenticate('/api/auth/login'); });
registerButton.addEventListener('click', () => authenticate('/api/auth/register'));
logoutButton.addEventListener('click', async () => {
  accountFeedback.textContent = '';
  try {
    await api('/api/auth/logout', { method: 'POST' });
    displayAccount(null);
  } catch (error) { accountFeedback.textContent = error.message; }
});

async function loadAccount() {
  try {
    const { user } = await api('/api/auth/me');
    displayAccount(user);
  } catch { displayAccount(null); }
}

document.querySelector('#refresh-events').addEventListener('click', loadEvents);
loadEvents();
loadAccount();
