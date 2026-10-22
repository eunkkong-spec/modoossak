(() => {
  // 공지 · 뉴스 게시판: data/news.json(직접 쓰는 글) + weekly.json · pest.json(영농정보) + tv.json(모두싹TV 영상)을 날짜순으로 합침
  const board = document.querySelector('[data-news-board]');
  if (!board) return;

  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const load = (url) => fetch(url, { cache: 'no-cache' }).then((res) => res.json()).catch(() => null);
  const $ = (name) => board.querySelector(`[data-news-${name}]`);
  const els = { filter: $('filter'), search: $('search'), count: $('count'), list: $('list'), more: $('more') };
  const CATEGORIES = ['공지', '회사 소식', '방송 · 홈쇼핑', '영농정보', '모두싹TV'];
  const PAGE = 10;
  let posts = [];
  let category = '전체';
  let query = '';
  let shown = PAGE;

  const parts = (iso) => iso.split('-').map(Number);
  const dateLabel = (iso) => iso.replace(/-/g, '.');
  const isNew = (iso) => iso.length === 10 && (Date.now() - new Date(iso).getTime()) / 864e5 <= 14;
  const weekLabel = (iso) => { const [, m, d] = parts(iso); return `${m}월 ${Math.ceil(d / 7)}주`; };
  const halfLabel = (start, end) => {
    const [, m, d] = parts(start); const [, , ed] = parts(end);
    if (d >= 16) return `${m}월 하반기`;
    return ed <= 15 ? `${m}월 상반기` : `${m}월`;
  };

  const collect = ([news, weekly, pest, tv]) => {
    const list = [...(news?.posts || [])];
    (weekly?.issues || []).forEach((issue) => list.push({
      date: issue.start, category: '영농정보', title: `${weekLabel(issue.start)} 주간농사정보 (제${issue.no}호)`, link: 'farm.html#weekly',
    }));
    (pest?.issues || []).forEach((issue) => list.push({
      date: issue.start, category: '영농정보', title: `${halfLabel(issue.start, issue.end)} 병해충 발생정보 (제${issue.no}호)`, link: 'farm.html#pests',
    }));
    (tv?.videos || []).filter((v) => v.date).forEach((v) => list.push({
      date: v.date,
      category: v.category === '방송 · 홈쇼핑' ? '방송 · 홈쇼핑' : v.category === '제품 · 회사 소식' ? '회사 소식' : '모두싹TV',
      title: v.title, link: `https://www.youtube.com/watch?v=${v.id}`, video: true,
    }));
    // news.json의 pinned(링크)는 맨 위 고정 → 공지 → 나머지 최신순
    const pinned = news?.pinned || [];
    list.forEach((post) => { post.pinned = pinned.includes(post.link); });
    return list.sort((a, b) => (b.pinned - a.pinned) || (b.category === '공지') - (a.category === '공지') || b.date.localeCompare(a.date));
  };

  const matches = (post) => (category === '전체' || post.category === category)
    && (!query || post.title.replace(/\s+/g, '').toLowerCase().includes(query.replace(/\s+/g, '').toLowerCase()));

  const renderFilter = () => {
    const names = ['전체', ...CATEGORIES.filter((name) => posts.some((p) => p.category === name))];
    els.filter.innerHTML = names.map((name) => {
      const count = name === '전체' ? posts.length : posts.filter((p) => p.category === name).length;
      return `<button type="button" class="news-filter__btn" aria-pressed="${name === category}" data-category="${esc(name)}">${esc(name)}<span>${count}</span></button>`;
    }).join('');
  };

  const renderList = () => {
    const found = posts.filter(matches);
    els.count.textContent = query ? `'${query}' 검색 결과 ${found.length}건` : `전체 ${found.length}건`;
    els.list.innerHTML = found.length ? found.slice(0, shown).map((post) => {
      const external = /^https?:/.test(post.link);
      return `
      <li>
        <a class="news-row${post.pinned ? ' is-pinned' : ''}" href="${esc(post.link)}"${external ? ' target="_blank" rel="noopener"' : ''}>
          <span class="news-row__cat news-row__cat--${CATEGORIES.indexOf(post.category)}">${esc(post.category)}</span>
          <span class="news-row__title">${post.pinned ? '<b class="news-row__pin">📌 고정</b>' : ''}${esc(post.title)}${isNew(post.date) ? '<b class="news-row__new">NEW</b>' : ''}</span>
          <span class="news-row__meta">${post.video ? '▶ 영상 · ' : ''}<time datetime="${esc(post.date)}">${dateLabel(post.date)}</time>${external ? ' ↗' : ''}</span>
        </a>
      </li>`;
    }).join('') : '<li class="news-empty">검색 결과가 없습니다. 다른 낱말로 찾아보세요.</li>';
    els.more.hidden = found.length <= shown;
    els.more.textContent = `더보기 (${found.length - shown}건) ▾`;
  };

  els.filter.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    shown = PAGE;
    renderFilter();
    renderList();
  });
  els.search.addEventListener('submit', (event) => {
    event.preventDefault();
    query = els.search.elements.q.value.trim();
    shown = PAGE;
    renderList();
    els.count.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  // 검색창을 비우면(× 버튼 포함) 검색 해제
  els.search.elements.q.addEventListener('input', (event) => { if (!event.target.value && query) { query = ''; renderList(); } });
  els.more.addEventListener('click', () => { shown += PAGE; renderList(); });

  Promise.all(['data/news.json', 'data/weekly.json', 'data/pest.json', 'data/tv.json'].map(load)).then((data) => {
    posts = collect(data);
    renderFilter();
    renderList();
  });
})();
