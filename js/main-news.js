(() => {
  // 메인 '공지 · NEWS': 공지·뉴스 게시판과 같은 데이터(js/news-data.js)에서 맨 위 5개를 자동으로 보여줌
  // → data/news.json에 새 글을 넣거나 주간농사정보·영상이 갱신되면 메인에도 바로 반영
  const box = document.querySelector('[data-main-news]');
  if (!box || !window.NewsData) return;
  const { esc, dateLabel, isNew } = window.NewsData;
  const SHOW = 5;
  // 목록 앞 꼬리표는 짧게
  const TAG = { 공지: '공지', '회사 소식': '소식', '방송 · 홈쇼핑': '방송', 영농정보: '영농정보', 모두싹TV: '모두싹TV' };

  window.NewsData.posts().then((posts) => {
    if (!posts.length) return;
    box.innerHTML = posts.slice(0, SHOW).map((post) => `
      <a href="${esc(post.href)}"${post.external ? ' target="_blank" rel="noopener"' : ''}>
        <b>${post.pinned ? '📌 ' : ''}${esc(TAG[post.category] || post.category)}</b>
        <span class="news-list__title">${esc(post.title)}${isNew(post.date) ? '<i class="news-list__new">NEW</i>' : ''}</span>
        <time datetime="${esc(post.date)}">${dateLabel(post.date)}</time>
      </a>`).join('');
  });
})();
