# 퀵메뉴 (보관용)

2026-10-21 메인페이지에서 일단 삭제하면서 원래 코드를 그대로 보관했습니다. 다시 쓰려면 아래 코드를 각 파일의 같은 자리에 넣으면 됩니다.

## index.html (히어로 section 바로 뒤, `.hero__brand-mark` 앞)

```html
    <nav class="quick-nav" aria-label="빠른 메뉴"><a href="#products">제품<br>정보</a><a href="farm.html">병해충<br>정보</a><a href="farm.html#weekly">주간농사<br>정보</a><a href="#stories">모두싹<br>TV</a><a href="#news">대리점<br>찾기</a><a class="quick-nav__top" href="#top">TOP</a></nav>
```

## css/main.css

```css
/* 기본 */
.quick-nav { position: fixed; z-index: 9; top: 50%; right: 22px; display: grid; gap: 8px; transform: translateY(-50%); }
.quick-nav a { display: grid; min-width: 64px; min-height: 64px; place-items: center; padding: 7px; border: 1px solid transparent; border-radius: 8px; background: #55755f; color: #fff; font: 700 12px/1.35 var(--f-title); text-align: center; box-shadow: 0 4px 12px rgb(0 0 0 / 10%); transition: background-color .18s ease, color .18s ease, transform .18s ease, box-shadow .18s ease; }
.quick-nav a:nth-child(1) { background: #6b8e4e; }
.quick-nav a:nth-child(2) { background: #5a7a63; }
.quick-nav a:nth-child(3) { background: #4a6953; }
.quick-nav a:nth-child(4) { background: #3b5745; }
.quick-nav a:nth-child(5) { background: #2f4a3a; }
.quick-nav .quick-nav__top { background: #22352a; }
.quick-nav a:hover, .quick-nav a:focus-visible { border-color: #d6a63a; background: #d6a63a; color: #26332b; transform: translateX(-4px); box-shadow: 0 6px 16px rgb(0 0 0 / 16%); }
.quick-nav a[aria-current="location"] { border-color: #d6a63a; background: #2f4a3a; color: #fff; box-shadow: 0 0 0 2px rgb(214 166 58 / 45%), 0 6px 16px rgb(0 0 0 / 15%); }
.quick-nav a[aria-current="location"]:hover { background: #d6a63a; color: #26332b; }
/* @media (max-width: 900px) 안 */
	.quick-nav { right: 10px; }
	.quick-nav a { min-width: 52px; min-height: 52px; font-size: 10px; }
/* @media (max-width: 640px) 안: .hero__scroll과 함께 숨김 */
	.hero__scroll, .quick-nav { display: none; }
/* 글자 크기 조정 블록 */
.quick-nav a { min-width: 68px; min-height: 68px; font-size: 14px; }
/* 글자 크기 조정 블록의 @media (max-width: 900px) 안 */
	.quick-nav a { min-width: 58px; min-height: 58px; font-size: 12px; }
```

## js/main.js (맨 끝, 즉시 실행 함수 닫기 전)

```js
  const quickLinks = [...document.querySelectorAll('.quick-nav a')];
  quickLinks.forEach((link) => {
    link.addEventListener('click', () => {
      quickLinks.forEach((item) => item.removeAttribute('aria-current'));
      link.setAttribute('aria-current', 'location');
    });
  });
```

참고: `.hero__brand-mark`(모두싹 로고)의 위치 `bottom: calc(50% + 276px)`는 퀵메뉴 바로 위에 오도록 맞춰져 있었습니다.
