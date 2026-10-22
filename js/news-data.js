// 공지 · 뉴스 게시글 모으기 (공지·뉴스 게시판 news.html과 메인 '공지 · NEWS' 목록이 같이 사용)
// data/news.json(직접 쓰는 글) + weekly.json · pest.json(영농정보) + tv.json(모두싹TV 영상)을 합쳐
// 고정(pinned) → 공지 → 최신순으로 정렬. 새 글을 news.json에 넣으면 두 곳에 함께 나타남
window.NewsData = (() => {
  const CATEGORIES = ['공지', '회사 소식', '방송 · 홈쇼핑', '영농정보', '모두싹TV'];
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const load = (url) => fetch(url, { cache: 'no-cache' }).then((res) => res.json()).catch(() => null);
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
    // 본문(body)이 있는 글은 글 보기 페이지로 연결 (post.html?id=글ID)
    const list = (news?.posts || []).map((post, i) => {
      const id = post.id || `post-${i}`;
      return { ...post, id, href: post.body ? `post.html?id=${encodeURIComponent(id)}` : post.link };
    });
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
    const pinned = news?.pinned || [];
    list.forEach((post) => {
      post.href = post.href || post.link;
      post.external = /^https?:/.test(post.href);
      post.pinned = pinned.includes(post.link);
    });
    return list.sort((a, b) => (b.pinned - a.pinned) || (b.category === '공지') - (a.category === '공지') || b.date.localeCompare(a.date));
  };

  const posts = () => Promise.all(['data/news.json', 'data/weekly.json', 'data/pest.json', 'data/tv.json'].map(load)).then(collect);

  return { CATEGORIES, esc, dateLabel, isNew, posts };
})();
