// ---------- year in footer ----------
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ---------- scroll reveal ----------
const revealTargets = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window && revealTargets.length) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
  );
  revealTargets.forEach((el) => io.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add('is-visible'));
}

// ---------- close other FAQ items on open (accordion behavior) ----------
const faqItems = document.querySelectorAll('.faq-item');
faqItems.forEach((item) => {
  item.addEventListener('toggle', () => {
    if (item.open) {
      faqItems.forEach((other) => {
        if (other !== item) other.open = false;
      });
    }
  });
});

// ---------- waitlist form ----------
const WAITLIST_ENDPOINT = 'https://formspree.io/f/mnjkgrev';

const form = document.getElementById('waitlist-form');
const status = document.getElementById('waitlist-status');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.classList.remove('error');
    status.textContent = '';

    const data = new FormData(form);
    const email = (data.get('email') || '').toString().trim();
    if (!email) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Joining…';

    try {
      const res = await fetch(WAITLIST_ENDPOINT, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: data,
      });
      if (res.ok) {
        status.textContent = "You're on the list. We'll email you the day Halmoni goes live.";
        form.reset();
      } else {
        status.classList.add('error');
        status.textContent = 'Something went wrong. Please try again.';
      }
    } catch {
      status.classList.add('error');
      status.textContent = 'Network error. Please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalLabel;
    }
  });
}
