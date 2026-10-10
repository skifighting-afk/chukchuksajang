# chukchuksajang.co.kr

척척사장 브랜드 홈페이지 배포 전용 저장소. 내용은 [skifighting-afk/chuckchuck](https://github.com/skifighting-afk/chuckchuck)의 `site/`에서 만든다.

- 배포: `.github/workflows/pages.yml`이 척척사장 저장소 main을 받아 `node scripts/build-home.mjs --site _site`로 만들고 GitHub Pages에 올린다(push · 매시간 · 수동 실행).
- 고칠 곳: 문구·디자인은 척척사장 저장소의 `site/`, 요금·계산식은 `lib/`. 이 저장소는 고치지 않는다.
- 설정: Settings → Pages → Source: GitHub Actions, Custom domain: chukchuksajang.co.kr, Enforce HTTPS.
