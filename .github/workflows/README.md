# workflows

GitHub Actions の workflow を置く。

`pages.yml` は、main への push で lint、test、build を行い、成功したとき GitHub Pages に公開する。ランナーは Ubuntu 26.04、ビルドの base パスは `/sd-bed-frame/` である。
