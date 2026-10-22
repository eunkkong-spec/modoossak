(() => {
  // 서브페이지 탭 공통 (news.html, tech.html): 탭 링크 href="#id" ↔ 같은 id의 패널
  const tabs = [...document.querySelectorAll('.page-tabs__item[role="tab"]')];
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
  // 메뉴에서 같은 페이지의 다른 탭으로 옮기면 탭 줄이 보이게 올려 줌
  window.addEventListener('hashchange', () => {
    showTab(location.hash.slice(1));
    document.querySelector('.page-tabs')?.scrollIntoView({ block: 'start' });
  });
  showTab(location.hash.slice(1));
})();
