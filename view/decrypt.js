// Zero-knowledge care-kit viewer. Mirrors the encryption performed by the
// halmoni mobile app: AES-GCM-256, PBKDF2-SHA256 key derivation from the
// user's passphrase. Decryption happens entirely in the browser via WebCrypto
// — no plaintext, no passphrase, no derived key ever leaves this tab.

(function () {
  const KEY_BYTES = 32;
  const els = {
    passphrase: document.getElementById('passphrase'),
    decrypt: document.getElementById('decrypt'),
    error: document.getElementById('error'),
    stageP: document.getElementById('stage-passphrase'),
    stageC: document.getElementById('stage-content'),
  };

  function showError(msg) {
    els.error.textContent = msg;
    els.error.classList.remove('hidden');
  }
  function clearError() {
    els.error.textContent = '';
    els.error.classList.add('hidden');
  }

  function getShareIdFromUrl() {
    // Vercel rewrite maps /view/XYZ → /view/index.html, so read the path.
    const m = window.location.pathname.match(/^\/view\/([^\/?#]+)/);
    if (m) return m[1];
    const q = new URLSearchParams(window.location.search).get('id');
    return q;
  }

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function fetchMetadata(shareId) {
    const url = `${window.HALMONI_SUPABASE_URL}/rest/v1/rpc/get_share_kit_metadata`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: window.HALMONI_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${window.HALMONI_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ kit_id: shareId }),
    });
    if (!res.ok) throw new Error(`Metadata lookup failed (${res.status}).`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('This link has been revoked or has expired.');
    }
    return rows[0];
  }

  async function fetchCiphertext(storagePath) {
    const url = `${window.HALMONI_SUPABASE_URL}/storage/v1/object/public/share-kits/${storagePath}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Content fetch failed (${res.status}).`);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }

  async function deriveKey(passphrase, salt, iterations) {
    const enc = new TextEncoder();
    const material = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: KEY_BYTES * 8 },
      false,
      ['decrypt'],
    );
  }

  async function decrypt(passphrase, meta, ciphertext) {
    const salt = base64ToBytes(meta.salt_b64);
    const iv = base64ToBytes(meta.iv_b64);
    const key = await deriveKey(passphrase, salt, meta.kdf_iterations);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function calcAge(dob) {
    if (!dob) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
    return age;
  }

  function scheduleText(sched) {
    if (!sched || sched.length === 0) return '';
    return sched
      .map((s) => `${s.time}${s.withFood ? ' (with food)' : ''}`)
      .join(' · ');
  }

  function render(payload) {
    const p = payload.parent;
    const age = calcAge(p.dob);
    const label = (p.nickname && p.nickname.trim()) || p.name;

    const conditions = (p.conditions || []).length
      ? p.conditions.map((c) => `<span class="tag">${esc(c)}</span>`).join('')
      : '<span class="muted">None recorded</span>';
    const allergies = (p.allergies || []).length
      ? p.allergies.map((a) => `<span class="tag danger">⚠ ${esc(a)}</span>`).join('')
      : '<span class="muted">No known allergies</span>';

    const medsRows = (payload.medications || []).length
      ? payload.medications
          .map(
            (m) => `
            <tr>
              <td><strong>${esc(m.name)}</strong>${m.dose ? ` <span class="muted">${esc(m.dose)}</span>` : ''}</td>
              <td>${esc(scheduleText(m.schedule))}</td>
              <td class="muted">${esc(m.purpose)}</td>
            </tr>`,
          )
          .join('')
      : '<tr><td colspan="3" class="muted">No medications recorded</td></tr>';

    const ice = (p.ice_contacts || []).length
      ? p.ice_contacts
          .map(
            (c) => `
        <div class="row">
          <div><strong>${esc(c.name)}</strong> <span class="muted">${esc(c.relation)}</span></div>
          <div class="mono">${esc(c.phone)}</div>
        </div>`,
          )
          .join('')
      : '<span class="muted">No ICE contacts recorded</span>';

    const doctor = p.primary_doctor
      ? `<div>${esc(p.primary_doctor.name || '')}</div>
         ${p.primary_doctor.phone ? `<div class="mono">${esc(p.primary_doctor.phone)}</div>` : ''}`
      : '<span class="muted">Not recorded</span>';

    const pharmacy = p.pharmacy
      ? `<div>${esc(p.pharmacy.name || '')}</div>
         ${p.pharmacy.phone ? `<div class="mono">${esc(p.pharmacy.phone)}</div>` : ''}
         ${p.pharmacy.address ? `<div class="muted">${esc(p.pharmacy.address)}</div>` : ''}`
      : '<span class="muted">Not recorded</span>';

    const insurance = p.insurance
      ? `<div>${esc(p.insurance.provider || '')}${p.insurance.planName ? ` — ${esc(p.insurance.planName)}` : ''}</div>
         ${p.insurance.memberId ? `<div class="mono">Member: ${esc(p.insurance.memberId)}</div>` : ''}
         ${p.insurance.groupId ? `<div class="mono">Group: ${esc(p.insurance.groupId)}</div>` : ''}
         ${p.insurance.phone ? `<div class="mono">${esc(p.insurance.phone)}</div>` : ''}`
      : '<span class="muted">Not recorded</span>';

    els.stageC.innerHTML = `
      <div class="banner">This care kit was decrypted locally in your browser. It has not been sent to a server.</div>
      <div class="card">
        <h2 style="margin-top:0">${esc(label)}${age != null ? ` <span class="muted">· ${age}</span>` : ''}</h2>
        ${p.blood_type ? `<div class="muted">Blood type: ${esc(p.blood_type)}</div>` : ''}
        <h2>Allergies</h2>
        <div>${allergies}</div>
        <h2>Conditions</h2>
        <div>${conditions}</div>
        ${p.preferences ? `<h2>Preferences</h2><p>${esc(p.preferences)}</p>` : ''}
      </div>

      <div class="card">
        <h2 style="margin-top:0">Medications</h2>
        <table>
          <thead><tr><th>Name</th><th>Schedule</th><th>Purpose</th></tr></thead>
          <tbody>${medsRows}</tbody>
        </table>
      </div>

      <div class="card">
        <h2 style="margin-top:0">In case of emergency</h2>
        <div>${ice}</div>
      </div>

      <div class="card">
        <h2 style="margin-top:0">Primary doctor</h2>
        ${doctor}
        <h2>Pharmacy</h2>
        ${pharmacy}
        <h2>Insurance</h2>
        ${insurance}
      </div>

      <div class="muted" style="text-align:center; margin-top:16px;">
        Generated ${esc(new Date(payload.generatedAt).toLocaleString())}${payload.generatedBy ? ` by ${esc(payload.generatedBy)}` : ''}
      </div>
    `;
    els.stageP.classList.add('hidden');
    els.stageC.classList.remove('hidden');
  }

  async function onDecrypt() {
    clearError();
    if (window.__CONFIG_MISSING) {
      showError('Site config missing. Copy view/config.example.js → view/config.js and fill in Supabase URL + anon key.');
      return;
    }
    const shareId = getShareIdFromUrl();
    if (!shareId) {
      showError('No share id in URL.');
      return;
    }
    const passphrase = els.passphrase.value;
    if (!passphrase) {
      showError('Enter the passphrase.');
      return;
    }
    els.decrypt.disabled = true;
    els.decrypt.textContent = 'Unlocking…';
    try {
      const meta = await fetchMetadata(shareId);
      const ciphertext = await fetchCiphertext(meta.storage_path);
      const payload = await decrypt(passphrase, meta, ciphertext);
      render(payload);
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      // WebCrypto throws a DOMException with no message for bad key — surface a friendly hint.
      if (/OperationError|decrypt/i.test(msg) || msg === 'DOMException' || !msg) {
        showError('Wrong passphrase, or the link has been tampered with.');
      } else {
        showError(msg);
      }
    } finally {
      els.decrypt.disabled = false;
      els.decrypt.textContent = 'Unlock';
    }
  }

  els.decrypt.addEventListener('click', onDecrypt);
  els.passphrase.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onDecrypt();
  });
})();
