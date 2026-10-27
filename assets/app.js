(() => {
  const $ = s => document.querySelector(s);
  const base = document.body.dataset.base;
  const dialog = $('#search-dialog'), input = $('#search-input'), results = $('#search-results');
  let indexPromise, timer, toastTimer;
  const notice = text => { const el = $('.toast'); el.textContent = text; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 2200); };
  try { if (localStorage.getItem('kb-theme') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch {}
  $('.theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('kb-theme', next); } catch {}
  });
  const toggleMenu = open => { $('#sidebar').classList.toggle('is-open', open); $('.mobile-backdrop').hidden = !open; $('.menu-toggle').setAttribute('aria-expanded', String(open)); };
  $('.menu-toggle').addEventListener('click', () => toggleMenu(!$('#sidebar').classList.contains('is-open')));
  $('.mobile-backdrop').addEventListener('click', () => toggleMenu(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') toggleMenu(false); if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); } });
  const getIndex = () => indexPromise ??= fetch(`${base}search.json`).then(r => { if (!r.ok) throw new Error('Search unavailable'); return r.json(); }).catch(e => { indexPromise = null; throw e; });
  const empty = text => { results.replaceChildren(); const p = document.createElement('p'); p.className = 'search-empty'; p.textContent = text; results.append(p); };
  async function search() {
    const query = input.value.trim().toLocaleLowerCase();
    if (!query) { empty('输入关键词，查找笔记中的知识。'); return; }
    try {
      const docs = await getIndex();
      if (input.value.trim().toLocaleLowerCase() !== query) return;
      const terms = query.split(/\s+/);
      const hits = docs.map(d => ({ ...d, score: terms.reduce((n, t) => n + (d.title.toLocaleLowerCase().includes(t) ? 10 : 0) + (d.text.toLocaleLowerCase().includes(t) ? 1 : 0), 0) })).filter(d => terms.every(t => `${d.title} ${d.text}`.toLocaleLowerCase().includes(t))).sort((a, b) => b.score - a.score).slice(0, 30);
      if (!hits.length) { empty(`没有找到“${input.value.trim()}”相关内容，试试其他关键词。`); return; }
      results.replaceChildren();
      for (const doc of hits) {
        const link = document.createElement('a'); link.className = 'search-result'; link.href = `${base}articles/${doc.id}.html${doc.anchor ? `#${encodeURIComponent(doc.anchor)}` : ''}`;
        const small = document.createElement('small'); small.textContent = `${doc.category} · ${doc.updated}`;
        const title = document.createElement('strong'); title.textContent = doc.title;
        const excerpt = document.createElement('p');
        const found = doc.text.toLocaleLowerCase().indexOf(terms[0]), start = Math.max(0, found - 35);
        const snippet = `${start ? '…' : ''}${doc.text.slice(start, start + 180)}…`;
        const pos = snippet.toLocaleLowerCase().indexOf(terms[0]);
        if (pos >= 0) { const mark = document.createElement('mark'); mark.textContent = snippet.slice(pos, pos + terms[0].length); excerpt.append(snippet.slice(0, pos), mark, snippet.slice(pos + terms[0].length)); }
        else excerpt.textContent = snippet;
        link.append(small, title, excerpt); results.append(link);
      }
    } catch { empty('搜索暂时不可用，请检查网络后重新输入。'); }
  }
  function openSearch() { if (!dialog.open) dialog.showModal(); input.focus(); search(); }
  document.querySelectorAll('.search-trigger').forEach(el => el.addEventListener('click', openSearch));
  $('.close-search').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) { const box = dialog.getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) dialog.close(); } });
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 100); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') results.querySelector('a')?.click(); });
  document.querySelectorAll('.markdown-body pre').forEach(pre => {
    const code = pre.querySelector('code');
    const label = document.createElement('span'); label.className = 'code-label'; label.textContent = [...code.classList].find(c => c.startsWith('language-'))?.slice(9) || 'code';
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'copy-code'; copy.textContent = '复制'; copy.setAttribute('aria-label', '复制这段代码');
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(code.textContent); copy.textContent = '已复制'; setTimeout(() => { copy.textContent = '复制'; }, 1800); }
      catch { notice('复制失败，请选中代码后手动复制。'); }
    });
    pre.append(label, copy);
  });
  const tocLinks = [...document.querySelectorAll('.toc-link')];
  if (tocLinks.length) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length) tocLinks.forEach(a => a.classList.toggle('current', a.hash === `#${encodeURIComponent(visible[0].target.id)}` || decodeURIComponent(a.hash) === `#${visible[0].target.id}`));
    }, { rootMargin: '-80px 0px -65% 0px' });
    document.querySelectorAll('.markdown-body h2,.markdown-body h3').forEach(h => observer.observe(h));
  }
  document.querySelectorAll('.category-filter').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.category-filter').forEach(b => b.classList.toggle('selected', b === button));
    document.querySelectorAll('.document-card').forEach(card => { card.hidden = !!button.dataset.category && card.querySelector('.category-pill').textContent !== button.dataset.category; });
  }));
  document.querySelectorAll('[data-viewer]').forEach(viewer => {
    const panels = [...viewer.querySelectorAll('[data-preview-panel]')];
    const selection = viewer.querySelector('[data-preview-select]');
    const previous = viewer.querySelector('[data-preview-prev]'), next = viewer.querySelector('[data-preview-next]');
    const show = id => {
      const index = panels.findIndex(panel => panel.id === id);
      if (index < 0) return;
      panels.forEach((panel, i) => { panel.hidden = i !== index; });
      selection.value = id;
      previous.disabled = index === 0;
      next.disabled = index === panels.length - 1;
    };
    const choose = offset => { const index = panels.findIndex(p => p.id === selection.value); show(panels[index + offset]?.id); };
    previous.addEventListener('click', () => choose(-1));
    next.addEventListener('click', () => choose(1));
    selection.addEventListener('change', () => show(selection.value));
    const followHash = () => { const id = decodeURIComponent(location.hash.slice(1)); if (panels.some(p => p.id === id)) { show(id); viewer.scrollIntoView({ block: 'start' }); } };
    show(panels[0]?.id);
    followHash();
    window.addEventListener('hashchange', followHash);
    let zoom = 100;
    viewer.querySelectorAll('[data-zoom]').forEach(button => button.addEventListener('click', () => {
      zoom = Math.max(50, Math.min(200, zoom + (button.dataset.zoom === 'in' ? 25 : -25)));
      viewer.style.setProperty('--preview-zoom', zoom / 100);
      viewer.querySelector('[data-zoom-label]').textContent = `${zoom}%`;
      viewer.querySelector('[data-zoom="out"]').disabled = zoom === 50;
      viewer.querySelector('[data-zoom="in"]').disabled = zoom === 200;
    }));
  });
})();
