# INA BASEBALL
高校野球のスコア・配球・打球分析アプリの試作。

## 開発
Node.js 24 / npm 11 で確認済み。

```sh
npm ci
npm run dev -- --port 5173
```

## 検証
```sh
npm run build
node --test tests/record.test.js
```

## 現在の範囲
- 球種・タップしたコース・打球位置と打席結果を記録
- カウント・攻守交代の計算、直前の記録取り消し
- 球種割合・打球分布、記録一覧印刷、JSON書き出し
- ブラウザのlocalStorageに1試合保存。新しい試合で置き換え

共同編集、認証、選手管理、詳細な走者訂正、正式なスコアブックは未実装。
四死球の強制進塁・押し出し、本塁打の全走者生還、走塁死に対応。
安打・失策では塁打数分を仮進塁。追加の進塁は走者欄で入力できます。
塁打数未満の進塁など、実際の状況への詳細訂正は今後対応。
イニング別得点を集計し、延長回も表示。
ブラウザのデータ削除に備えてJSONを書き出してください。JSON再読込は未実装。

## GitHub Pages
リポジトリの Settings → Pages → Build and deployment → Source を
**GitHub Actions** に設定してください。mainへのpushでテスト・ビルド後、distを公開します。
アセットは相対パスのため `/inabaseball/` 配下でも読み込めます。
