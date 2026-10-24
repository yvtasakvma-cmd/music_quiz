# Cadence

iPhone 向けの縦型 PWA。メジャーキーの **ii m7 → V7 → I maj7** を、2オクターブの鍵盤で練習します。最初の問題は D♭ メジャー。キー選択と、採点後のランダムな次の問題は12キーに対応しています。

## 使い方

1. 鍵盤の異なる4音をタップして選択。再タップで解除できます。
2. 「鳴らす」で、現在選択した音を同時に確認できます。
3. 「OK」でそのコードを確定。上の丸が黄色になり、次へ進みます。丸をタップすると入力内容を見直せます。編集すると確定が解除されるので、再度 OK を押してください。
4. 3つを確定したら、下の「回答する」で採点。オクターブ・転回形は問いません。同じ音名を複数オクターブで重ねる代わりに、異なる4つの音名を選びます。
5. 採点後は正解の構成音と和音を確認し、同じキーを再練習するか、次のキーへ進めます。

音は Web Audio で合成し、音源ファイル・外部 API・ログインは使いません。入力中の回答は再読み込みでリセットされます。

## 開発

Node.js 24 と npm を使用します。

```sh
cd /workspace/music_quiz
npm ci --cache /tmp/music-quiz-npm-cache
npm run dev -- --port 5173
```

開発サーバーはポート 5173。本番用ビルドと PWA の確認は以下で行います。

```sh
npm test
npm run build
npm run test:e2e
npm run preview -- --port 4173
```

E2E はモバイル幅の Chromium で、鍵盤選択・解除、実際の AudioContext の同時発音、3コードの採点、編集、やり直し、320px 幅、オフライン再起動を確認します。`/usr/bin/chromium` がある環境ではそれを使います。それ以外では `npx playwright install chromium` でテスト用ブラウザを導入してください。任意の実行ファイルを `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` で指定することもできます。

## iPhone で使う

`npm run build` でできる `dist/` を HTTPS 対応の静的ホスティングに配置してください。サブディレクトリへの配置にも対応します。Safari で公開先を開き、共有メニューの「ホーム画面に追加」を選びます。

初回読み込み時にアプリ本体とアイコンをキャッシュし、以降はオフラインでも起動・出題・再生できます。オフライン機能は本番ビルドでのみ有効です。HTTPS（開発環境では localhost）が必要です。使い方を開くとオフライン準備の状態を確認できます。音が出ない場合は iPhone の音量・消音設定も確認してください。

実機の Safari・ホーム画面からの起動・本体スピーカーの確認は、公開後に行ってください。

## GitHub Pages への公開

このリポジトリには `.github/workflows/deploy.yml` を用意しています。GitHub の [Settings → Pages](https://github.com/yvtasakvma-cmd/music_quiz/settings/pages) で **Build and deployment → Source → GitHub Actions** を有効にしてください。

`main` へ push すると、依存関係の導入・コードのテスト・PWA ビルド後に `dist/` が公開されます。既存の失敗した実行があれば、[Actions](https://github.com/yvtasakvma-cmd/music_quiz/actions/workflows/deploy.yml) から **Run workflow** または **Re-run all jobs** で再実行できます。

標準の公開先は `https://yvtasakvma-cmd.github.io/music_quiz/` です。初回は GitHub Pages の有効化とワークフローの成功が必要です。公開されたら iPhone の Safari で開き、共有メニューから「ホーム画面に追加」を選んでください。
