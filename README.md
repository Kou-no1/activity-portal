# 学級づくり実践ナビ

先生の困りごとから、短い切り替え活動・指導のコツ・SST・SGE・PAを探し、声かけと手順を確認して実践する静的Webアプリです。

## 使えること

- 5つの困りごと、学年、場面、時間、方法から検索。従来の人数・場所・ねらい・時期も利用できます。
- 「今、その場で整える」「毎日の手順を育てる」「力と関係を育てる」の3段階から提案。
- 既存30活動＋切り替え活動10件＋指導のコツ10件。全件に最初と終わりの声かけ、次の行動、調整と参加方法を収録。
- マイ引き出し、今日使う3件、実践後の短い記録、児童向け提示、タイマー、カードの印刷・PDF保存。
- 旧 `actDone_v1` の実施済み記録を引き継ぎます。保存はブラウザー単位です。児童名の入力・記録送信はありません。

## 配置

`index.html`、`styles.css`、`app.js`、`core.js`、`catalog.js` を同じディレクトリーへ配置します。React・Babel・外部CDNは不要です。

総合ポータル `Kou-no1/apli_portal` の更新版は、同じドメインの `../activity-portal/catalog.js` と `../activity-portal/core.js` を参照します。公開する際は **activity-portal → apli_portal** の順に反映してください。総合ポータルを先に反映した場合も、既存アプリ検索と活動集へのリンクは利用できます。

## コンテンツを編集する

- `legacy-activities.json`：従来30件の原稿。
- `legacy-meta.json`：従来活動への悩み・学年・場面・台本・投影手順等の追加情報。原文の修正は `override` に指定。
- `support-content.json`：短い活動10件と教師のコツ10件。
- `build-catalog.mjs`：上記を検証し、共通の `catalog.js` を生成。

```sh
node build-catalog.mjs
node --test tests/core.test.cjs
node --check app.js
```

`catalog.js` は生成物です。原稿を編集したら再生成し、一緒にコミットしてください。

## 既存のスプレッドシート連携

既存の公開GAS URLを `app.js` で継続使用します。まず組み込み50件を表示し、取得成功後に既存活動の本文・動画を更新します。失敗・オフライン時も組み込み原稿と端末内のキャッシュで利用できます。ネットワークやGAS側の公開設定により更新できない場合があります。

GASに新しいIDのPA・SGE・SSTを追加した場合も一覧に取り込みます。対象学年等が未設定の活動は自動推薦から外し、「学年を確認」と表示します。追加活動の保存・記録を再読み込み後も保持するため、取得データを端末にキャッシュします。

指導内容を修正した `sst02`、`sst03`、`sst06`、`pa05`、`pa07`、`sge06` はローカルの指導文を優先し、動画だけGASから更新します。内容と新しい台本が食い違うことを防ぎます。

## URL

- `?issue=listen`：困りごとを選択。
- `?issue=routine&stage=now`：場面と段階を組み合わせる。
- `?id=calm01`：実践カードを直接開く。
- `?view=saved`：マイ引き出し。
- `?q=給食`：検索語を引き継ぐ。

## 検証と限界

Nodeの要件テスト9件に加え、Chromeで総合検索からの移動、保存・予定・記録の再読み込み復元、提示の切り替えとタイマー、360px幅の表示を確認しました。iPhone・Android実機と印刷ダイアログからの実際のPDF出力は未確認です。

参考： [IES / WWC Teacher-Delivered Behavioral Interventions in Grades K-5](https://ies.ed.gov/ncee/WWC/PracticeGuide/31/Published)。短い活動は編集上の実践案であり、個々のゲームの効果を保証するものではありません。
