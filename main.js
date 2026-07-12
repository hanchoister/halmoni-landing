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

    if (!WAITLIST_ENDPOINT) {
      status.textContent = "Thanks — you're on the list. (Endpoint not configured yet.)";
      form.reset();
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Joining…';

    try {
      const res = await fetch(WAITLIST_ENDPOINT, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: data,
      });
      if (res.ok) {
        status.textContent = "You're on the list. We'll email you when Halmoni goes live.";
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
      submitBtn.textContent = originalLabel;
    }
  });
}
