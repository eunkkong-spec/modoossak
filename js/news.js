(() => {
  // 공지 · 뉴스 게시판: 글 모으기·정렬은 js/news-data.js (메인 '공지 · NEWS'와 같은 데이터)
  const board = document.querySelector('[data-news-board]');
  if (!board) return;

  const { CATEGORIES, esc, dateLabel, isNew } = window.NewsData;
  const $ = (name) => board.querySelector(`[data-news-${name}]`);
  const els = { filter: $('filter'), search: $('search'), count: $('count'), list: $('list'), more: $('more') };
  const PAGE = 10;
  let posts = [];
  let category = '전체';
  let query = '';
  let shown = PAGE;

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
      const external = post.external;
      return `
      <li>
        <a class="news-row${post.pinned ? ' is-pinned' : ''}" href="${esc(post.href)}"${external ? ' target="_blank" rel="noopener"' : ''}>
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

  window.NewsData.posts().then((list) => {
    posts = list;
    renderFilter();
    renderList();
  });
})();
