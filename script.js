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

/* ---- payment method: cash pays at the FAF cabinet, card by MIA transfer.
   Fall additionally points each option at a specific organizer: card
   shows a scannable MIA QR + a link to Adelina to confirm payment, cash
   points to Ana for questions - so payers don't have to go hunting for
   contact info elsewhere on the page. */
const PAYMENT_MESSAGES = {
  cash: 'You can come to the FAF cabinet to pay in cash.',
  card: 'You can transfer by MIA to 078 259 025.'
};
const ADELINA_TELEGRAM = 'https://t.me/v6mp1r30';
const ANA_TELEGRAM = 'https://t.me/anishoara_duta';
const MIA_QR_LINK = 'https://mia-qr.bnm.md/1/m/BNM/MCBebd4b05706d144309dead8e846f3cbe3';
const MIA_QR_IMAGE = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(MIA_QR_LINK);
const paymentNote = document.getElementById('paymentNote');

function cardPaymentHTML() {
  return '' +
    '<span class="mia-pay">' +
      '<a class="mia-qr-link" href="' + MIA_QR_LINK + '" target="_blank" rel="noopener" aria-label="Open the MIA payment link">' +
        '<img class="mia-qr-img" src="' + MIA_QR_IMAGE + '" width="100" height="100" alt="QR code for the MIA payment link" loading="lazy">' +
      '</a>' +
      '<a class="mia-qr-textlink" href="' + MIA_QR_LINK + '" target="_blank" rel="noopener">Pay by MIA &#8594;</a>' +
    '</span>' +
    '<span class="mia-pay-note">Please, after paying, send a screenshot with your name and surname to organizer ' +
      '<a href="' + ADELINA_TELEGRAM + '" target="_blank" rel="noopener">Adelina</a>.' +
    '</span>';
}

function cashPaymentHTML() {
  return PAYMENT_MESSAGES.cash + ' For more details, you can ask organizer ' +
    '<a href="' + ANA_TELEGRAM + '" target="_blank" rel="noopener">Ana</a>.';
}

function updatePaymentNote() {
  const checked = document.querySelector('input[name="payment"]:checked');
  if (!checked) { paymentNote.innerHTML = ''; return; }
  if (EVENT_ID === 'fall-2026' && checked.value === 'card') {
    paymentNote.innerHTML = cardPaymentHTML();
  } else if (EVENT_ID === 'fall-2026' && checked.value === 'cash') {
    paymentNote.innerHTML = cashPaymentHTML();
  } else {
    paymentNote.textContent = PAYMENT_MESSAGES[checked.value] || '';
  }
}
document.querySelectorAll('input[name="payment"]').forEach(function (radio) {
  radio.addEventListener('change', updatePaymentNote);
});
updatePaymentNote();

/* ---- Firebase (event settings + registrations + gallery metadata) --
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
  if (!eventDate) return; // no date yet - nothing to compute an "opens"/"today" state against
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
    // Firestore unreachable, or nothing saved yet - keep the defaults
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
      regStatus.textContent = 'Registration isn’t connected yet - please try again later or reach us on Telegram.';
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
      regStatus.textContent = 'That did not go through - check your connection and try again.';
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

/* ---- party gallery ---------------------------------------------
   For AFTER the party: guests upload photos and videos here. The
   actual file goes to Cloudinary (a free media host - no card needed,
   unlike Firebase Storage) via an unsigned upload preset; a small
   metadata doc (its URL + type) lands in Firestore at
   events/{EVENT_ID}/gallery so everyone who opens the page - not just
   the uploader's own browser - sees and can download it live. */
const CLOUDINARY_CLOUD_NAME = window.XFAF_CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_UPLOAD_PRESET = window.XFAF_CLOUDINARY_UPLOAD_PRESET || '';
function cloudinaryConfigured() {
  return !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_CLOUD_NAME.indexOf('REPLACE_ME') === -1
    && CLOUDINARY_UPLOAD_PRESET && CLOUDINARY_UPLOAD_PRESET.indexOf('REPLACE_ME') === -1);
}
async function uploadToCloudinary(file, isVideo) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  const resourceType = isVideo ? 'video' : 'image';
  const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/' + resourceType + '/upload', {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('cloudinary upload failed: ' + res.status);
  return res.json(); // { secure_url, public_id, ... }
}

const MAX_PHOTO_WIDTH = 1600;
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;   // 15 MB
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;  // 150 MB - raise this only after
                                             // checking your Cloudinary upload
                                             // preset's own max file size
const galleryGrid = document.getElementById('galleryGrid');
const galleryEmpty = document.getElementById('galleryEmpty');
const photoInput = document.getElementById('photoInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const galleryEl = document.querySelector('.gallery');
const selectBtn = document.getElementById('selectBtn');
const gallerySelectBar = document.getElementById('gallerySelectBar');
const gallerySelectCount = document.getElementById('gallerySelectCount');
const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
const clearSelectedBtn = document.getElementById('clearSelectedBtn');
const galleryLightbox = document.getElementById('galleryLightbox');
const galleryLightboxMedia = document.getElementById('galleryLightboxMedia');
const galleryLightboxClose = document.getElementById('galleryLightboxClose');
const galleryLightboxPrev = document.getElementById('galleryLightboxPrev');
const galleryLightboxNext = document.getElementById('galleryLightboxNext');
const galleryLightboxCount = document.getElementById('galleryLightboxCount');
const galleryLightboxDownload = document.getElementById('galleryLightboxDownload');
const galleryLightboxBackdrop = document.getElementById('galleryLightboxBackdrop');

if (uploadBtn) {
  uploadBtn.addEventListener('click', function () { photoInput.click(); });
}

// selection state for "download the ones I pick" - keyed by Firestore doc id
// so it survives the live re-renders triggered by startGalleryListener
const galleryItems = new Map();
const selectedIds = new Set();

function updateSelectBar() {
  if (!gallerySelectBar) return;
  const n = selectedIds.size;
  gallerySelectBar.hidden = n === 0;
  if (gallerySelectCount) gallerySelectCount.textContent = n + (n === 1 ? ' selected' : ' selected');
  if (downloadSelectedBtn) downloadSelectedBtn.disabled = n === 0;
}

function clearSelection() {
  selectedIds.clear();
  document.querySelectorAll('.gallery-item.selected').forEach(function (el) { el.classList.remove('selected'); });
  document.querySelectorAll('.gallery-select input').forEach(function (cb) { cb.checked = false; });
  updateSelectBar();
}

if (selectBtn) {
  selectBtn.addEventListener('click', function () {
    const active = galleryEl.classList.toggle('selecting');
    selectBtn.textContent = active ? 'Done' : 'Select';
    selectBtn.classList.toggle('active', active);
    if (!active) clearSelection();
  });
}

if (clearSelectedBtn) {
  clearSelectedBtn.addEventListener('click', clearSelection);
}

// adds ?fl_attachment so Cloudinary serves the file with
// Content-Disposition: attachment - a real download in every browser,
// including Safari, which otherwise ignores the <a download> attribute
// for cross-origin files
function attachmentUrl(url) {
  return url.indexOf('/upload/') === -1 ? url : url.replace('/upload/', '/upload/fl_attachment/');
}

function extFromUrl(url) {
  const m = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(url);
  return m ? m[1] : '';
}

if (downloadSelectedBtn) {
  downloadSelectedBtn.addEventListener('click', async function () {
    const ids = Array.from(selectedIds);
    downloadSelectedBtn.disabled = true;
    for (let i = 0; i < ids.length; i++) {
      const item = galleryItems.get(ids[i]);
      if (!item) continue;
      const ext = extFromUrl(item.url);
      const a = document.createElement('a');
      a.href = attachmentUrl(item.url);
      a.download = 'xfaf-' + item.type + '-' + (i + 1) + (ext ? '.' + ext : '');
      document.body.appendChild(a);
      a.click();
      a.remove();
      // stagger so the browser doesn't lump these into one blocked
      // "multiple automatic downloads" request
      await new Promise(function (resolve) { setTimeout(resolve, 400); });
    }
    downloadSelectedBtn.disabled = selectedIds.size === 0;
  });
}

// full-size preview, with prev/next through whatever is currently loaded
let lightboxId = null;

function openLightbox(id) {
  if (!galleryLightbox) return;
  lightboxId = id;
  renderLightbox();
  galleryLightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  if (!galleryLightbox || galleryLightbox.hidden) return;
  galleryLightbox.hidden = true;
  galleryLightboxMedia.innerHTML = '';
  lightboxId = null;
  document.body.style.overflow = '';
}

function renderLightbox() {
  const ids = Array.from(galleryItems.keys());
  const idx = ids.indexOf(lightboxId);
  if (idx === -1) { closeLightbox(); return; }
  const item = galleryItems.get(lightboxId);

  galleryLightboxMedia.innerHTML = '';
  if (item.type === 'video') {
    const vid = document.createElement('video');
    vid.src = item.url;
    vid.controls = true;
    vid.autoplay = true;
    galleryLightboxMedia.appendChild(vid);
  } else {
    const pic = document.createElement('img');
    pic.src = item.url;
    pic.alt = 'Photo from the party';
    galleryLightboxMedia.appendChild(pic);
  }

  galleryLightboxCount.textContent = (idx + 1) + ' of ' + ids.length;
  galleryLightboxPrev.hidden = ids.length < 2;
  galleryLightboxNext.hidden = ids.length < 2;
  galleryLightboxDownload.href = attachmentUrl(item.url);
}

function stepLightbox(delta) {
  const ids = Array.from(galleryItems.keys());
  const idx = ids.indexOf(lightboxId);
  if (idx === -1) return;
  lightboxId = ids[(idx + delta + ids.length) % ids.length];
  renderLightbox();
}

if (galleryLightboxPrev) galleryLightboxPrev.addEventListener('click', function () { stepLightbox(-1); });
if (galleryLightboxNext) galleryLightboxNext.addEventListener('click', function () { stepLightbox(1); });
if (galleryLightboxClose) galleryLightboxClose.addEventListener('click', closeLightbox);
if (galleryLightboxBackdrop) galleryLightboxBackdrop.addEventListener('click', closeLightbox);
document.addEventListener('keydown', function (e) {
  if (!galleryLightbox || galleryLightbox.hidden) return;
  if (e.key === 'Escape') closeLightbox();
  else if (e.key === 'ArrowLeft') stepLightbox(-1);
  else if (e.key === 'ArrowRight') stepLightbox(1);
});
// shrink a photo before upload so it saves fast and doesn't burn
// through everyone's data plan; returns a Blob, which FormData and
// Cloudinary's upload endpoint both accept directly
function shrinkImage(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      const img = new Image();
      img.onload = function () {
        let w = img.width;
        let h = img.height;
        if (w > MAX_PHOTO_WIDTH) {
          h = Math.round(h * (MAX_PHOTO_WIDTH / w));
          w = MAX_PHOTO_WIDTH;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob); else reject(new Error('could not process image'));
        }, 'image/jpeg', 0.85);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downloadIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 19h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
}

function playIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
}

function addGalleryItem(id, item) {
  const cell = document.createElement('div');
  cell.className = 'gallery-item';
  cell.dataset.id = id;
  if (selectedIds.has(id)) cell.classList.add('selected');

  let mediaEl;
  if (item.type === 'video') {
    // no native controls here - the thumbnail is just a poster frame;
    // tapping it opens the full preview where it actually plays
    mediaEl = document.createElement('video');
    mediaEl.src = item.url;
    mediaEl.muted = true;
    mediaEl.preload = 'metadata';
    cell.appendChild(mediaEl);
    const play = document.createElement('div');
    play.className = 'gallery-play';
    play.setAttribute('aria-hidden', 'true');
    play.innerHTML = '<span>' + playIcon() + '</span>';
    cell.appendChild(play);
  } else {
    mediaEl = document.createElement('img');
    mediaEl.src = item.url;
    mediaEl.alt = 'Photo from the party';
    mediaEl.loading = 'lazy';
    cell.appendChild(mediaEl);
  }
  mediaEl.setAttribute('role', 'button');
  mediaEl.tabIndex = 0;
  mediaEl.setAttribute('aria-label', (item.type === 'video' ? 'Play this video' : 'View this photo') + ' full size');
  mediaEl.addEventListener('click', function () {
    if (galleryEl && galleryEl.classList.contains('selecting')) return; // the cell-level toggle below handles this click instead
    openLightbox(id);
  });
  mediaEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mediaEl.click(); }
  });

  const selectLabel = document.createElement('label');
  selectLabel.className = 'gallery-select';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = selectedIds.has(id);
  checkbox.setAttribute('aria-label', 'Select this ' + item.type + ' for download');
  checkbox.addEventListener('change', function () {
    if (checkbox.checked) selectedIds.add(id); else selectedIds.delete(id);
    cell.classList.toggle('selected', checkbox.checked);
    updateSelectBar();
  });
  selectLabel.appendChild(checkbox);
  cell.appendChild(selectLabel);

  const dl = document.createElement('a');
  dl.className = 'gallery-download';
  dl.href = attachmentUrl(item.url);
  dl.download = '';
  dl.rel = 'noopener';
  dl.setAttribute('aria-label', 'Download this ' + item.type);
  dl.innerHTML = downloadIcon();
  cell.appendChild(dl);

  // while selecting, tapping anywhere on the tile toggles it - much
  // easier to hit than the small checkbox alone
  cell.addEventListener('click', function (e) {
    if (!galleryEl || !galleryEl.classList.contains('selecting')) return;
    if (e.target === checkbox) return; // the checkbox's own change handler above already covers this click
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event('change'));
  });

  galleryGrid.appendChild(cell);
  galleryEmpty.hidden = true;
}

// live: everyone who has the page open sees new uploads land, not
// just after a refresh
function startGalleryListener() {
  if (!db) return;
  eventDoc().collection('gallery').orderBy('createdAt', 'desc').limit(300).onSnapshot(function (snap) {
    galleryGrid.innerHTML = '';
    galleryEmpty.hidden = !snap.empty;
    galleryItems.clear();
    const liveIds = new Set();
    snap.forEach(function (doc) {
      galleryItems.set(doc.id, doc.data());
      liveIds.add(doc.id);
      addGalleryItem(doc.id, doc.data());
    });
    // drop selections for items that no longer exist (e.g. removed by an organizer)
    Array.from(selectedIds).forEach(function (id) { if (!liveIds.has(id)) selectedIds.delete(id); });
    updateSelectBar();
  }, function (err) {
    // Firestore unreachable - leave whatever was already rendered
  });
}

if (photoInput) {
  photoInput.addEventListener('change', async function () {
    const files = Array.from(photoInput.files || []);
    photoInput.value = '';
    if (!files.length) return;

    if (!cloudinaryConfigured() || !db) {
      uploadStatus.textContent = 'The gallery isn’t connected yet - please try again later.';
      return;
    }

    const multi = files.length > 1;
    uploadBtn.disabled = true;
    let uploaded = 0;
    let skipped = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.indexOf('video/') === 0;
      const isImage = file.type.indexOf('image/') === 0;

      if (!isImage && !isVideo) {
        if (!multi) uploadStatus.textContent = 'Please choose a photo or video file.';
        skipped++;
        continue;
      }
      const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
      if (file.size > maxBytes) {
        if (!multi) uploadStatus.textContent = 'That file is too large (max ' + Math.round(maxBytes / 1024 / 1024) + ' MB).';
        skipped++;
        continue;
      }

      uploadStatus.textContent = multi
        ? 'Uploading ' + (i + 1) + ' of ' + files.length + '…'
        : (isVideo ? 'Uploading your video…' : 'Uploading your photo…');
      try {
        const uploadFile = isImage ? await shrinkImage(file) : file;
        const result = await uploadToCloudinary(uploadFile, isVideo);
        await eventDoc().collection('gallery').add({
          url: result.secure_url,
          publicId: result.public_id,
          type: isVideo ? 'video' : 'photo',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        uploaded++;
      } catch (err) {
        skipped++;
        if (!multi) uploadStatus.textContent = 'That did not upload - check your connection and try again.';
      }
    }

    if (multi) {
      uploadStatus.textContent = skipped === 0
        ? 'Added all ' + uploaded + ', thanks for sharing!'
        : uploaded === 0
          ? 'Nothing uploaded - check the files and try again.'
          : 'Added ' + uploaded + ' of ' + files.length + ' - the rest didn’t make it through.';
    } else if (uploaded === 1) {
      uploadStatus.textContent = 'Added, thanks for sharing!';
    }
    uploadBtn.disabled = false;
  });
  startGalleryListener();
}
