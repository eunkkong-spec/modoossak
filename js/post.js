(() => {
  // 공지 · 뉴스 글 보기 (post.html?id=글ID): data/news.json에서 본문(body)이 있는 글을 한 페이지로 보여줌
  const box = document.querySelector('[data-post]');
  if (!box || !window.NewsData) return;
  const { CATEGORIES, esc, dateLabel } = window.NewsData;
  const id = new URLSearchParams(location.search).get('id');

  const notFound = () => {
    box.innerHTML = `
      <p class="post__empty">글을 찾을 수 없습니다. 삭제되었거나 주소가 바뀌었을 수 있어요.</p>
      <p class="post__actions"><a class="post__list" href="news.html#notice">목록으로</a></p>`;
  };

  window.NewsData.posts().then((posts) => {
    // 앞뒤 글 이동은 게시판 순서(고정 → 최신순) 중 본문이 있는 글끼리
    const articles = posts.filter((p) => p.body);
    const i = articles.findIndex((p) => p.id === id);
    if (i < 0) { notFound(); return; }
    const post = articles[i];
    const prev = articles[i + 1];  // 이전 글(더 오래된 글)
    const next = articles[i - 1];  // 다음 글(더 새 글)
    document.title = `${post.title} | 공지 · 뉴스 | 나라바이오 모두싹`;

    box.innerHTML = `
      <header class="post__head">
        <p class="post__cat"><span class="news-row__cat news-row__cat--${CATEGORIES.indexOf(post.category)}">${esc(post.category)}</span></p>
        <h1 class="post__title">${esc(post.title)}</h1>
        <p class="post__meta"><time datetime="${esc(post.date)}">${dateLabel(post.date)}</time> · 나라바이오</p>
      </header>
      <div class="post__body">
        ${post.body.map((p) => `<p>${esc(p)}</p>`).join('')}
        ${post.youtube ? `
        <figure class="post__video">
          <iframe src="https://www.youtube-nocookie.com/embed/${esc(post.youtube)}?rel=0" title="${esc(post.title)} 영상" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
          <figcaption><a href="https://www.youtube.com/shorts/${esc(post.youtube)}" target="_blank" rel="noopener">유튜브에서 보기 ↗</a></figcaption>
        </figure>` : ''}
        ${post.footer ? `<p class="post__footer">${esc(post.footer)}</p>` : ''}
      </div>
      <nav class="post__nav" aria-label="이전 · 다음 글">
        ${next ? `<a href="post.html?id=${encodeURIComponent(next.id)}"><span>다음 글 ▲</span>${esc(next.title)}</a>` : '<p><span>다음 글 ▲</span>다음 글이 없습니다.</p>'}
        ${prev ? `<a href="post.html?id=${encodeURIComponent(prev.id)}"><span>이전 글 ▼</span>${esc(prev.title)}</a>` : '<p><span>이전 글 ▼</span>이전 글이 없습니다.</p>'}
      </nav>
      <p class="post__actions"><a class="post__list" href="news.html#notice">목록으로</a></p>`;
  }).catch(notFound);
})();
