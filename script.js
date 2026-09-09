// Shared behaviour for every xFAF edition page (spring-2026, fall-2026, ...).
// Each edition's index.html sets window.XFAF_EVENT_ID before loading this
// file, so one script serves every edition while keeping their data apart:
// registrations, settings and photos all live under events/{EVENT_ID}/...
const EVENT_ID = window.XFAF_EVENT_ID || 'spring-2026';

const foodOtherText = document.getElementById('foodOtherText');
const foodOtherRadio = document.getElementById('foodOther');

document.querySelectorAll('input[name="food"]').forEach(function (radio) {
  radio.addEventListener('change', function () {
    const isOther = foodOtherRadio.checked;
    foodOtherText.hidden = !isOther;
    if (isOther) foodOtherText.focus();
  });
});
foodOtherText.addEventListener('input', function () {
  document.getElementById('foodOther').checked = true;
});

/* ---- payment method: cash pays at the FAF cabinet, card by MIA transfer */
const PAYMENT_MESSAGES = {
  cash: 'You can come to the FAF cabinet to pay in cash.',
  card: 'You can transfer by MIA to 078 259 025.'
};
const paymentNote = document.getElementById('paymentNote');
function updatePaymentNote() {
  const checked = document.querySelector('input[name="payment"]:checked');
  paymentNote.textContent = checked ? (PAYMENT_MESSAGES[checked.value] || '') : '';
}
document.querySelectorAll('input[name="payment"]').forEach(function (radio) {
  radio.addEventListener('change', updatePaymentNote);
});
updatePaymentNote();

/* ---- Firebase (event settings + registrations) -----------------
   firebase-config.js is a shared, non-secret project id; until it
   is filled in the site just keeps showing its static defaults */
let db = null;
try {
  const cfg = window.XFAF_FIREBASE_CONFIG;
  if (window.firebase && cfg && cfg.apiKey && cfg.apiKey.indexOf('REPLACE_ME') === -1) {
    firebase.initializeApp(cfg);
    db = firebase.firestore();
  }
} catch (err) {
  db = null;
}
function eventDoc() { return db.collection('events').doc(EVENT_ID); }

/* ---- countdown -------------------------------------------------
   default event date; an organizer's saved settings can replace it.
   A page with no real date yet (window.XFAF_DEFAULT_DATE unset) shows
   "date to be announced" instead of counting down to a made-up one. */
let eventDate = window.XFAF_DEFAULT_DATE ? new Date(window.XFAF_DEFAULT_DATE) : null;
let countdownTimer = null;

const countdown = document.getElementById('countdown');
const cd = {
  days: document.getElementById('cdDays'),
  hours: document.getElementById('cdHours'),
  mins: document.getElementById('cdMins'),
  secs: document.getElementById('cdSecs')
};

function updateCountdown() {
  const diff = eventDate - new Date();
  if (diff <= 0) {
    countdown.classList.add('is-tonight');
    return true;
  }
  countdown.classList.remove('is-tonight');
  cd.days.textContent = Math.floor(diff / 86400000);
  cd.hours.textContent = String(Math.floor(diff / 3600000) % 24).padStart(2, '0');
  cd.mins.textContent = String(Math.floor(diff / 60000) % 60).padStart(2, '0');
  cd.secs.textContent = String(Math.floor(diff / 1000) % 60).padStart(2, '0');
  return false;
}
function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  if (!eventDate) {
    countdown.classList.add('is-unset');
    return;
  }
  countdown.classList.remove('is-unset');
  if (!updateCountdown()) {
    countdownTimer = setInterval(function () {
      if (updateCountdown()) clearInterval(countdownTimer);
    }, 1000);
  }
}
startCountdown();

/* ---- mark the price that applies today ------------------------
   the windows share the event's year, so moving the edition only
   means changing eventDate; callable again after settings load */
function markTierPricing() {
  if (!eventDate) return; // no date yet — nothing to compute an "opens"/"today" state against
  const year = eventDate.getFullYear();
  const today = new Date();
  const rungs = [].slice.call(document.querySelectorAll('#ladder .rung'));
  let live = null;
  let next = null;

  rungs.forEach(function (rung) {
    rung.classList.remove('is-now', 'is-past', 'is-next');
    rung.querySelector('.rung-tag').textContent = '';
    const from = new Date(year + '-' + rung.dataset.from + 'T00:00:00');
    const to = new Date(year + '-' + rung.dataset.to + 'T23:59:59');
    if (today > to) rung.classList.add('is-past');
    else if (today >= from) live = rung;
    else if (!next) next = rung;
  });

  if (live) {
    live.classList.add('is-now');
    live.querySelector('.rung-tag').textContent = "Today's price";
  } else if (next) {
    // no window is open yet, so say when the cheapest seat goes on sale
    next.classList.add('is-next');
    next.querySelector('.rung-tag').textContent = 'Opens ' + next.dataset.opens;
  }
}
markTierPricing();

/* ---- organizer-edited event settings ---------------------------
   progressive enhancement: the page above already renders and
   works from its static defaults; this only patches it if the
   organizer has saved something for this edition in /xfaf-organizatori */
async function loadEventSettings() {
  if (!db) return;
  try {
    const snap = await eventDoc().collection('settings').doc('event').get();
    if (!snap.exists) return;
    const s = snap.data() || {};

    if (s.eventDate) {
      const parsed = new Date(s.eventDate);
      if (!isNaN(parsed)) { eventDate = parsed; startCountdown(); }
    }
    setText('heroDate', s.dateLabel);
    setText('heroDateSub', s.dateSub);
    setText('heroVenue', s.venueName);
    setText('heroVenueSub', s.venueSub);
    setText('bundleHeadline', s.bundleHeadline);
    setText('bundleNote', s.bundleNote);
    setText('finePrint', s.finePrint);

    if (Array.isArray(s.tiers)) {
      const rungs = document.querySelectorAll('#ladder .rung');
      s.tiers.forEach(function (t, i) {
        const rung = rungs[i];
        if (!rung || !t) return;
        if (t.name) rung.querySelector('.rung-name').textContent = t.name;
        if (t.price != null) rung.querySelector('.rung-price').firstChild.nodeValue = t.price + ' ';
        if (t.dateLabel) rung.querySelector('.rung-meta').firstChild.nodeValue = t.dateLabel;
        if (t.from) rung.dataset.from = t.from;
        if (t.to) rung.dataset.to = t.to;
        if (t.opens) rung.dataset.opens = t.opens;
      });
    }
    markTierPricing(); // re-run once with whatever combination of eventDate/tiers just loaded
  } catch (err) {
    // Firestore unreachable, or nothing saved yet — keep the defaults
  }
}
function setText(id, value) {
  if (!value) return;
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
loadEventSettings();

/* ---- registration form ------------------------------------------
   writes straight to this edition's own Firestore data; the organizer
   dashboard at /xfaf-organizatori reads the same collection, scoped
   to whichever edition is selected there */
(function () {
  const regForm = document.getElementById('regForm');
  if (!regForm) return;
  const regStatus = document.getElementById('regStatus');
  const regSubmit = document.getElementById('regSubmit');
  const regDone = document.getElementById('regDone');

  function currentTierName() {
    const now = document.querySelector('#ladder .rung.is-now .rung-name');
    return now ? now.textContent.trim() : '';
  }
  function currentTierPrice() {
    const now = document.querySelector('#ladder .rung.is-now .rung-price');
    return now ? (parseInt(now.firstChild.textContent, 10) || 0) : 0;
  }

  regForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (document.getElementById('regHoneypot').value) return; // a bot filled the hidden field

    const name = document.getElementById('regName').value.trim();
    const group = document.getElementById('regGroup').value.trim();
    const contact = document.getElementById('regContact').value.trim();
    const note = document.getElementById('regNote').value.trim();
    const payment = document.querySelector('input[name="payment"]:checked').value;
    const beer = document.querySelector('input[name="beer"]:checked').value;
    const stay = document.querySelector('input[name="stay"]:checked').value;
    const food = document.querySelector('input[name="food"]:checked').value;
    const foodOther = food === 'other' ? foodOtherText.value.trim() : '';

    if (!name || !contact) {
      regStatus.textContent = 'Please fill in your name and a way to reach you.';
      return;
    }
    if (!db) {
      regStatus.textContent = 'Registration isn’t connected yet — please try again later or reach us on Telegram.';
      return;
    }

    regSubmit.disabled = true;
    regStatus.textContent = 'Saving your seat…';
    try {
      await eventDoc().collection('registrations').add({
        name: name,
        group: group,
        contact: contact,
        payment: payment,
        beer: beer,
        stay: stay,
        food: food,
        foodOther: foodOther,
        note: note,
        tier: currentTierName(),
        tierPrice: currentTierPrice(),
        paid: false,
        amountPaid: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      document.getElementById('regDoneName').textContent = name.split(' ')[0] || name;
      regForm.hidden = true;
      regDone.hidden = false;
    } catch (err) {
      regStatus.textContent = 'That did not go through — check your connection and try again.';
      regSubmit.disabled = false;
    }
  });
})();

/* ---- nav: underline the section you're reading ---------------- */
(function () {
  const links = new Map();
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    const el = document.querySelector(a.getAttribute('href'));
    if (el) links.set(el, a);
  });
  const seen = new Set();
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target);
    });
    links.forEach(function (a) { a.removeAttribute('aria-current'); });
    const first = [...links.keys()].find(function (el) { return seen.has(el); });
    if (first) links.get(first).setAttribute('aria-current', 'true');
  }, { rootMargin: '-66px 0px -55% 0px' });
  links.forEach(function (_, el) { io.observe(el); });
})();

/* ---- enlarge the printed sheets ------------------------------- */
(function () {
  const box = document.getElementById('lightbox');
  const shown = document.getElementById('lightboxImg');
  if (!box || typeof box.showModal !== 'function') return;
  document.querySelectorAll('.plate-zoom').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const pic = btn.querySelector('img');
      if (!pic) return;
      shown.src = pic.src;
      shown.alt = pic.alt;
      box.showModal();
    });
  });
  const closeBtn = document.getElementById('lightboxClose');
  if (closeBtn) closeBtn.addEventListener('click', function () { box.close(); });
  box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
  box.addEventListener('close', function () { shown.removeAttribute('src'); });
})();

/* ---- photo gallery -------------------------------------------
   window.storage is shared between everyone when the page runs
   on a host that provides it; on a plain file it falls back to
   this browser only, so the pictures at least survive a reload.
   Keys are namespaced per edition so Spring and Fall photos never mix. */
const store = (window.storage && typeof window.storage.set === 'function')
  ? window.storage
  : {
      list: async function (prefix) {
        return { keys: Object.keys(localStorage).filter(function (k) { return k.indexOf(prefix) === 0; }).sort() };
      },
      get: async function (key) {
        const value = localStorage.getItem(key);
        return value === null ? null : { value: value };
      },
      set: async function (key, value) { localStorage.setItem(key, value); }
    };

const PHOTO_PREFIX = 'photo:' + EVENT_ID + ':';
const MAX_WIDTH = 900;
const galleryGrid = document.getElementById('galleryGrid');
const galleryEmpty = document.getElementById('galleryEmpty');
const photoInput = document.getElementById('photoInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');

if (uploadBtn) {
  uploadBtn.addEventListener('click', function () { photoInput.click(); });
}

// make the picture smaller so it saves fast
function shrinkImage(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      const img = new Image();
      img.onload = function () {
        let w = img.width;
        let h = img.height;
        if (w > MAX_WIDTH) {
          h = Math.round(h * (MAX_WIDTH / w));
          w = MAX_WIDTH;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function addPhotoToGrid(dataUrl) {
  const pic = document.createElement('img');
  pic.src = dataUrl;
  pic.alt = 'Photo from the party';
  galleryGrid.appendChild(pic);
  galleryEmpty.hidden = true;
}

async function loadGallery() {
  try {
    const listResult = await store.list(PHOTO_PREFIX, true);
    const keys = listResult ? listResult.keys : [];
    if (!keys || keys.length === 0) return;
    for (const key of keys) {
      try {
        const item = await store.get(key, true);
        if (item) addPhotoToGrid(item.value);
      } catch (err) {
        // skip a photo that did not load
      }
    }
  } catch (err) {
    // nothing saved yet, keep the empty state showing
  }
}

if (photoInput) {
  photoInput.addEventListener('change', async function () {
    const file = photoInput.files[0];
    if (!file) return;
    uploadStatus.textContent = 'Adding your photo…';
    try {
      const smallPic = await shrinkImage(file);
      const key = PHOTO_PREFIX + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      await store.set(key, smallPic, true);
      addPhotoToGrid(smallPic);
      uploadStatus.textContent = 'Added, thanks for sharing.';
    } catch (err) {
      uploadStatus.textContent = (err && err.name === 'QuotaExceededError')
        ? 'There is no room left to save photos on this device.'
        : 'That photo would not save. Try a different one.';
    }
    photoInput.value = '';
  });
  loadGallery();
}
