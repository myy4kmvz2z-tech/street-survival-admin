# STREET SURVIVAL ADMIN β1.3 Effects Restore HUD

β1.2で戻した「押した感」に加えて、前のような大きいアイコン演出とイベント別サウンドを復活させた版です。

## β1.3 追加内容

- 中央にデカいイベントアイコン表示
- BOSS / SAFE / LIVE / FINAL などイベント別の演出
- イベント別サウンド
- BOSS / FINAL は画面が強めに反応
- 送信成功トースト
- ボタンSEND表示
- Firebase送信はβ1.2のまま維持

## 入っているファイル

- index.html
- admin.html
- admin.css
- admin.js
- firebase-config.js
- README.md

## 注意

Safariが古いJSを読んでいる場合は、URL末尾に `?v=13` を付けてください。

## Firebase Rules設定

イベント設定 v1.0 の「💾 設定を保存」で `PERMISSION_DENIED` が出る場合、Realtime Database の Rules で `streetSurvival/settings` への read/write が許可されていません。

### 設定手順

1. [Firebase Console](https://console.firebase.google.com/) を開く
2. **Realtime Database** を開く
3. **Rules** タブを開く
4. このリポジトリの `firebase-rules-example.json` の内容を貼り付ける
5. **Publish** を押す
6. 運営画面で **💾 設定を保存** を再度試し、**設定: 保存OK** になることを確認する

### ルール例ファイル

- `firebase-rules-example.json` — `players` / `currentCommand` / `commandLog` / `settings` への read/write を許可する例

本番運用では必要最小限の権限に絞ることを推奨します。
