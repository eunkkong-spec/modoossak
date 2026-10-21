(() => {
  // 모두싹TV: data/tv.json (유튜브 @SsakTV 채널 영상 목록)
  const grid = document.querySelector('[data-tv-grid]');
  if (!grid) return;

  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const $ = (name) => document.querySelector(`[data-tv-${name}]`);
  const els = {
    frame: $('frame'), category: $('now-category'), title: $('now-title'), link: $('now-link'), filter: $('filter'),
  };
  const thumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  let data = { categories: [], videos: [] };
  let filter = '전체';
  let current = '';

  // 위쪽 플레이어에 영상 띄우기 (play=true면 바로 재생)
  const play = (video, autoplay = false) => {
    current = video.id;
    els.frame.src = `https://www.youtube-nocookie.com/embed/${video.id}?rel=0${autoplay ? '&autoplay=1' : ''}`;
    els.frame.title = video.title;
    els.category.textContent = video === data.videos[0] ? `최신 영상 · ${video.category}` : video.category;
    els.title.textContent = video.title;
    els.link.href = `https://www.youtube.com/watch?v=${video.id}`;
    grid.querySelectorAll('[data-id]').forEach((card) => card.classList.toggle('is-playing', card.dataset.id === current));
  };

  const renderFilter = () => {
    els.filter.innerHTML = ['전체', ...data.categories].map((name) => {
      const count = name === '전체' ? data.videos.length : data.videos.filter((v) => v.category === name).length;
      return `<button type="button" class="tv-filter__btn" aria-pressed="${name === filter}" data-category="${esc(name)}">${esc(name)}<span>${count}</span></button>`;
    }).join('');
  };

  const renderGrid = () => {
    const shown = data.videos.filter((v) => filter === '전체' || v.category === filter);
    grid.innerHTML = shown.map((v) => `
      <li>
        <button type="button" class="tv-card${v.id === current ? ' is-playing' : ''}" data-id="${esc(v.id)}">
          <span class="tv-card__thumb"><img src="${thumb(v.id)}" alt="" loading="lazy"><span class="tv-card__len">${esc(v.length)}</span><span class="tv-card__now">재생 중</span></span>
          <span class="tv-card__cat">${esc(v.category)}</span>
          <span class="tv-card__title">${esc(v.title)}</span>
        </button>
      </li>`).join('');
  };

  els.filter.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    filter = button.dataset.category;
    renderFilter();
    renderGrid();
  });
  grid.addEventListener('click', (event) => {
    const card = event.target.closest('[data-id]');
    if (!card) return;
    play(data.videos.find((v) => v.id === card.dataset.id), true);
    document.querySelector('.tv-player')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });

  fetch('data/tv.json', { cache: 'no-cache' })
    .then((res) => res.json())
    .then((json) => {
      data = json;
      renderFilter();
      renderGrid();
      if (data.videos[0]) play(data.videos[0]);
    })
    .catch(() => { grid.innerHTML = '<li class="tv-empty">영상을 불러오지 못했습니다. 유튜브 채널에서 확인해 주세요.</li>'; });
})();
