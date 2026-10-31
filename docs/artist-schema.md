# 芸術家データ仕様

`data/artists/<id>.json` に1人1ファイル。`id` は小文字ローマ字の英数とハイフン（例: `jan-van-eyck`）。

```json
{
  "id": "jan-van-eyck",
  "name_ja": "ヤン・ファン・エイク",
  "name_en": "Jan van Eyck",
  "born": 1390,
  "died": 1441,
  "born_approx": true,
  "died_approx": false,
  "region": "netherlands",
  "movement": "early-netherlandish",
  "wikipedia_ja": "ヤン・ファン・エイク",
  "wikipedia_en": "Jan van Eyck",
  "wikidata": "Q102972",
  "summary": "日本語で200〜350字。事実に基づく簡潔な解説。",
  "keywords": ["油彩", "肖像画"],
  "related": ["rogier-van-der-weyden"],
  "works": [
    {
      "title_ja": "アルノルフィーニ夫妻の肖像",
      "title_en": "Arnolfini Portrait",
      "year": 1434,
      "medium": "板に油彩",
      "collection": "ロンドン、ナショナル・ギャラリー",
      "commons_file": "Van Eyck - Arnolfini Portrait.jpg"
    }
  ]
}
```

- `region`: italy / france / spain / netherlands / germany / britain / russia-east-europe / north-america / other
- `movement`: ancient / medieval / early-netherlandish / renaissance / mannerism / baroque / rococo / neoclassicism / romanticism / realism / impressionism / post-impressionism / symbolism / modern / contemporary
- `wikipedia_ja` / `wikipedia_en` は記事タイトルのみ（URLは生成時に組み立て）。確信がなければ省略。
- `commons_file` は Wikimedia Commons のファイル名（`File:` なし）。確実に存在すると確信できるものだけ。サイトのビルド時に Commons API で存在・ライセンス・作者・出典を検証し、パブリックドメイン／CC0／CC BY(-SA) 以外は自動的に除外される。
- `works` は1人あたり5〜8点。年代はおおよそでよいが、不確かなら省略。
- 没年が1955年より後の作家は、著作権が存続している可能性が高いので `works` を空配列にする。
- 生没年が不明確な場合は `*_approx: true`。事実に確信がない項目は書かない（創作しない）。
