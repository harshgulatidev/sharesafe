(() => {
  const source = document.querySelector('#source');
  const result = document.querySelector('#result');
  const count = document.querySelector('#source-count');
  const resultCount = document.querySelector('#redaction-count');
  const state = document.querySelector('#result-state');
  const copyButton = document.querySelector('#copy-result');
  const fileInput = document.querySelector('#file-input');
  const customTerms = document.querySelector('#custom-terms');
  const controls = [...document.querySelectorAll('[data-kind]')];
  let safeText = '';

  const patterns = {
    secret: [
      { label: 'PRIVATE_KEY', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/gi },
      { label: 'SECRET', regex: /\b(?:authorization\s*:\s*bearer\s+|bearer\s+)([A-Za-z0-9._~+/-]{12,}={0,2})/gi, group: 1 },
      { label: 'JWT', regex: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g },
      { label: 'GITHUB_TOKEN', regex: /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{30,})\b/g },
      { label: 'AWS_KEY', regex: /\bAKIA[0-9A-Z]{16}\b/g },
      { label: 'SLACK_TOKEN', regex: /\bxox[baprs]-[A-Za-z0-9-]{15,}\b/g },
      { label: 'STRIPE_KEY', regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{12,}\b/g },
      { label: 'SECRET', regex: /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|secret|token)\s*[:=]\s*["']?([^\s"'`,;]{6,})/gi, group: 1 }
    ],
    email: [{ label: 'EMAIL', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi }],
    phone: [{ label: 'PHONE', regex: /(?<![\w.])(?:\+?\d{1,3}[ .-]?)?(?:\(?\d{2,4}\)?[ .-]?)\d{3,4}[ .-]?\d{3,4}(?![\w.])/g }],
    ip: [{ label: 'IP', regex: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g }]
  };

  function findMatches(text) {
    const found = [];
    for (const control of controls) {
      if (!control.checked) continue;
      for (const item of patterns[control.dataset.kind]) {
        item.regex.lastIndex = 0;
        for (const match of text.matchAll(item.regex)) {
          const value = item.group ? match[item.group] : match[0];
          const offset = match.index + (item.group ? match[0].indexOf(value) : 0);
          if (value && value.length) found.push({ start: offset, end: offset + value.length, value, label: item.label });
        }
      }
    }
    const custom = [...new Set(customTerms.value.split(/\r?\n/).map(term => term.trim()).filter(term => term.length >= 2))].sort((a,b) => b.length-a.length);
    for (const term of custom) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      for (const match of text.matchAll(regex)) found.push({ start: match.index, end: match.index + match[0].length, value: match[0], label: 'CUSTOM' });
    }
    found.sort((a,b) => a.start - b.start || b.end - a.end);
    const accepted = [];
    for (const item of found) {
      const previous = accepted.at(-1);
      if (!previous || item.start >= previous.end) accepted.push(item);
      else if (item.start === previous.start && item.end > previous.end) accepted[accepted.length - 1] = item;
    }
    return accepted;
  }

  function scan() {
    const text = source.value;
    count.textContent = `${text.length.toLocaleString()} character${text.length === 1 ? '' : 's'}`;
    if (!text.trim()) {
      safeText = '';
      result.innerHTML = '<span class="placeholder-copy">Your cleaned text will<br>appear here.</span>';
      resultCount.textContent = 'Nothing redacted yet';
      state.textContent = 'Waiting for text';
      state.classList.remove('ready');
      copyButton.disabled = true;
      return;
    }
    const matches = findMatches(text);
    const occurrences = new Map();
    const pieces = [];
    let cursor = 0;
    for (const item of matches) {
      pieces.push({ text: text.slice(cursor, item.start) });
      const key = `${item.label}:${item.value.toLowerCase()}`;
      if (!occurrences.has(key)) occurrences.set(key, `${item.label}_${[...occurrences.keys()].filter(k => k.startsWith(`${item.label}:`)).length + 1}`);
      pieces.push({ text: `[${occurrences.get(key)}]`, redacted: true });
      cursor = item.end;
    }
    pieces.push({ text: text.slice(cursor) });
    safeText = pieces.map(piece => piece.text).join('');
    result.replaceChildren(...pieces.map(piece => {
      if (!piece.redacted) return document.createTextNode(piece.text);
      const mark = document.createElement('mark');
      mark.className = 'redacted';
      mark.textContent = piece.text;
      return mark;
    }));
    const kinds = new Set(matches.map(item => item.label.split('_')[0]));
    resultCount.textContent = matches.length ? `${matches.length} item${matches.length === 1 ? '' : 's'} redacted · ${kinds.size} type${kinds.size === 1 ? '' : 's'}` : 'No matches found — review before sharing';
    state.textContent = matches.length ? 'Scan complete' : 'No matches';
    state.classList.add('ready');
    copyButton.disabled = false;
  }

  source.addEventListener('input', scan);
  customTerms.addEventListener('input', scan);
  controls.forEach(control => control.addEventListener('change', scan));
  document.querySelector('#scan').addEventListener('click', scan);
  document.querySelector('#clear-source').addEventListener('click', () => { source.value = ''; scan(); source.focus(); });
  document.querySelector('#load-example').addEventListener('click', () => {
    source.value = `2026-04-18T10:42:13Z ERROR payment-service\nUser: priya.sharma@example.com\nContact: +91 98765 43210\nRemote host: 203.0.113.42\nAuthorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.signatureExampleValue12345\napi_key=demo_replace_this_with_a_real_test_key\nMessage: customer reports a failed checkout for order #48219.`;
    scan(); source.focus();
  });
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(safeText);
      copyButton.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8"/></svg>Copied';
      window.setTimeout(() => { copyButton.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="6" width="9" height="11" rx="1.5"/><path d="M13 6V4.8A1.8 1.8 0 0 0 11.2 3H5.8A1.8 1.8 0 0 0 4 4.8v7.4A1.8 1.8 0 0 0 5.8 14H7"/></svg>Copy safe text'; }, 1600);
    } catch { copyButton.textContent = 'Clipboard unavailable'; }
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    source.value = await file.text();
    scan();
    fileInput.value = '';
  });
  source.addEventListener('dragover', event => { event.preventDefault(); source.classList.add('dragging'); });
  source.addEventListener('dragleave', () => source.classList.remove('dragging'));
  source.addEventListener('drop', async event => {
    event.preventDefault(); source.classList.remove('dragging');
    const file = event.dataTransfer.files[0];
    if (file && /\.(txt|log|json)$/i.test(file.name)) { source.value = await file.text(); scan(); }
    else if (event.dataTransfer.getData('text')) { source.value = event.dataTransfer.getData('text'); scan(); }
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); scan(); }
  });
})();
