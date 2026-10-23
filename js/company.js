(() => {
  // 탭: #greeting 인사말 / #history 회사 연혁
  const tabs = [...document.querySelectorAll('.company-tabs__item')];
  if (!tabs.length) return;
  const breadcrumb = document.querySelector('[data-breadcrumb-current]');

  const showTab = (id) => {
    const current = tabs.find((tab) => tab.hash === `#${id}`) || tabs[0];
    tabs.forEach((tab) => {
      const selected = tab === current;
      tab.setAttribute('aria-selected', String(selected));
      const panel = document.getElementById(tab.hash.slice(1));
      if (panel) panel.hidden = !selected;
    });
    if (breadcrumb) breadcrumb.textContent = current.textContent;
  };

  tabs.forEach((tab) => tab.addEventListener('click', (event) => {
    event.preventDefault();
    history.replaceState(null, '', tab.hash);
    showTab(tab.hash.slice(1));
  }));
  // 메뉴의 '회사소개 · 연혁' 등으로 같은 페이지 안에서 옮기면 서브 히어로부터 보이게 맨 위로
  window.addEventListener('hashchange', () => {
    showTab(location.hash.slice(1));
    window.scrollTo({ top: 0 });
  });
  showTab(location.hash.slice(1));
})();
