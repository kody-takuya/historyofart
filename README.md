# 西洋美術史を学ぶ

芸術家の年表・解説ページ、毎朝のポッドキャスト付きブログ（毎週日曜は関東圏の美術展情報）を配信する静的サイトです。

- `data/artists/*.json` 芸術家データ（仕様は `docs/artist-schema.md`）
- `data/themes.json` 週替わりテーマ
- `content/posts/*.json` 生成された記事
- `scripts/` ビルド・画像検証（Wikimedia Commons）・Gemini による記事／音声生成
- `.github/workflows/` デプロイ（Cloud Run）と毎朝6時(JST)の自動生成

## 初回セットアップ
Google Cloud Shell で `scripts/gcp-setup.sh` を1回実行し、表示された値を GitHub の Secrets / Variables に登録します。

## ローカル確認
```
node scripts/validate.mjs && node scripts/build.mjs && node scripts/serve.mjs
```
