# DIY セミダブルベッドフレーム

2x4 / 1x4 と鬼目ナットで組む、上下分割・すのこ取り外し式の設計資料。

- [要件定義.md](要件定義.md)
- [設計書.md](設計書.md)
- [3DCGビューア](3d/index.html)

## 公開

GitHub Pages（`main` へ push すると Actions が公開する）。

- ビューア: https://argki.github.io/sd-bed-frame/
- リポジトリ: https://github.com/argki/sd-bed-frame

Three.js は CDN から読む。ビルドは不要。

## ローカル

リポジトリ根から出す。`3d/` だけを根にすると資料リンクが切れる。

```bash
python3 -m http.server 8765
```

`http://127.0.0.1:8765/3d/` をブラウザで表示する。
