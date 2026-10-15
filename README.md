# セミダブル収納ベッドフレーム

ダンボール箱を収納できる、4分割式ベースのセミダブルベッドフレームを、1x4 材で DIY するための設計である。公開ページには、購入する部材と費用、12f 材ごとのカット寸法図、組み立て済みの 3D、分解状態を表示する。

公開 URL: https://argki.github.io/sd-bed-frame/

参考イメージ: https://amzn.asia/d/04YD9cwX （4分割式の収納ベース）

## 設計の前提

- マットレスはセミダブル（幅 1200mm × 長さ 1950mm）。
- 収納するダンボール箱は、高さ 280mm × 横 380mm × 奥行き 270mm。箱の出し入れに必要な余裕を内寸に含める。
- ベースは4分割式。モジュールごとに運べる大きさにする。
- 外観は 1x4 材を組み合わせた見た目にする。
- 1x4 材の断面は 19mm × 89mm、12f の長さは 3650mm として計算する。
- 価格はビバホームで 1x4 12f が 1本 712円、カット代が 1カット 50円。
- のこぎりの刃の厚み（カットロス）は 3mm。`src/design/constants.ts` の `KERF` で定義し、変更できるようにする。

寸法、価格、カットロスなどの数値は `src/design/` で定義する。部材リスト、カット図、3D 表示は、その値を読む。

## ローカルでの起動

ホストに Node.js を入れず、Docker Compose で動かす。

開発サーバーは、次のコマンドで起動する。

```sh
docker compose up dev
```

ブラウザでは http://localhost:5173 を開く。

本番ビルドのプレビューは、次のコマンドで起動する。GitHub Pages と同じ base パス `/sd-bed-frame/` で動く。`docker compose run` はポートを公開しないため、`up` を使う。

```sh
docker compose up preview
```

ブラウザでは http://localhost:4173/sd-bed-frame/ を開く。

## フォーマット

ソースのフォーマットは、次のコマンドで行う。

```sh
docker compose run --rm format
```

lint とテストは、次のコマンドで行う。

```sh
docker compose run --rm lint
docker compose run --rm test
```
