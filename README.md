# Min-WLYT-Plus

CG / YouTube web app.  
「Min-wlyt-Plus」は、YouTube や動画視聴をより快適にするための Web アプリです。  
ブラウザからすぐにアクセスでき、PC・スマホ問わず軽量に動作することを目指しています。

---

## 特徴

- **軽量:** HTML + JavaScript ベースのシンプル構成
- **ホスティングしやすい:** Vercel / Render / Railway などの PaaS に対応しやすい構造
- **Node.js 対応:** `index.js` + `Procfile` によるサーバー起動が可能
- **設定ファイル付き:** `render.yaml` / `railway.json` などのデプロイ設定ファイルを同梱

---

## デプロイ

ワンクリックで自分の環境にデプロイできます。

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/woolisbest-honke/min-wlyt-plus)

### Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/woolisbest-honke/min-wlyt-plus)

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?templateUrl=https://github.com/woolisbest-honke/min-wlyt-plus)

---

## 必要要件

- **Node.js** (推奨: LTS)
- **npm** または **yarn**

---

## ローカル開発

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm start
# または
node index.js
```

---

## 更新履歴(min-wlyt-plus)
### ver1.0.5
 - Elixir-network、stream-proxy、nodeproxyを修正。
 - index.jsからwispserverを建て、localhostへのリクエストも可能にする。
 - 依存関係の整理
### ver1.0.4
 - Elixir-networkでのnode errorを修正。
 - 漫画raw・anime・映画は著作権違反ページ（dmca）に転移するように修正。（これによりrenderやrailwayにデプロイした際にbanされるリスクが低くなります、あとねむいが作ったやつ普通に犯罪だからこっちgithubアカウントとかbanされたらだるい。minoには許可とった。）

### ver1.0.3
- Elixir-networkでの漫画、映画が確実に使えるように調整
- WOOLsite追加
- educationパラメーターの修正
- LICENSEを更新
- package.jsonなどでの名称をmin-wlyt-plusに更新。
- 偽造ページなどのURLをこのリポジトリ内に移動することで、別のリポジトリへの依存をできるだけ減らす。
- 一応typescriptとreactにも対応させた。

## 更新履歴(min-tube-pro)
### ver1.4.9
- Elixir-networkを利用した映画を修正、アプリを使えるように改良
### ver1.4.8
- gameのランキング微調整
- チャットを追加、ぶっ壊れる気しかせんがな(
### ver1.4.7
- webLLMを使用してAIをそのデバイスに建てて使えるように<br>
- ビデオ通話をできるように<br>
- Elixir-Networkを利用した漫画と映画鑑賞<br>
- gameの人気順の可視化
### ver1.4.2
- 人気ホラーゲーム「R.E.P.O」をはじめ、ブロスタ、ダダサバイバー、サンズ戦、ジオメトリーダッシュ、あつ森、クッキークリッカーなどの人気ゲームを追加(「R.E.P.O」が、壊れてるのは気のせい、そうだ気のせいだ）
- クオリティが極限まで高いゲームをその他10個ほど追加
- 動作しなかったゲームの修正
- 動画サーバー Elixir をスマートフォンからでも使えるように強化
- 新しいプロキシ「GUST」を追加

### ver1.4.1
- Claude が無料で使えるように変更（認証が必要です）
- Portable 版のマインクラフトを追加
- ショート動画の埋め込み視聴に対応し、ショートの閲覧が可能に
- 新動画サーバー Elixir-Network を追加。Wisp サーバーの最適化により動画の読み込みを高速化

### ver1.4.0
- Elixir-Network と統合（詳細は[Elixir-Network について](#elixir-network-について)を参照）

### ver1.3.5
- Abyss V5 と統合（詳細は[Abyss V5 について](#abyss-v5-について)を参照）
- アニメ視聴ページへのルートを修正

### ver1.3.0
**新機能**
- ホーム画面で「ホーム画面に追加」することで擬似アプリ化（Apple のみ）
- アニメ視聴ページを追加

**MINTube の変更点**
- サムネイル取得方法の切り替えが可能に
- ショート動画の視聴に対応（失敗することがあります）
- 検索候補を表示

**ゲーム関連の変更点**
- ゲームのサムネイルを追加（順次追加）
- 複数のゲームを追加
- ゲーム一覧の表示方法を切り替え可能に

### ver1.2.4
- ゲームを6つ追加
- ゲームを A〜Z 順で読み込むように変更

### ver1.2.3
**新機能**
- チャンネル登録機能を追加
- チャンネル登録や閲覧履歴からホームの動画が変わるように変更

**バグ修正**
- 設定で GoogleVideo 以外に設定したとき、再生時に一瞬読み込まれてしまう問題を修正
- アカウントページ以外でアカウント画像が表示されない問題を修正
- ホームで下スクロールしても新たなコンテンツが読み込まれない問題を修正

**変更点**
- ゲームを1つ追加

### ver1.2.2
- しあtube を追加
- 公式URL一覧に応答速度を表示

### ver1.2.1
- ゲームを3つ追加
- wista を追加

### ver1.2.0
- 視聴履歴を追加
- 高評価した動画の一覧を表示可能に
- 個人用の再生リストを追加
- デザインを YouTube 風に変更
- モバイル UI に対応（MIN-Tube-Pro のみ）
- チャンネル閲覧を強化
- ゲームを2つ追加

### ver1.1.1
- MIN-Tube-Pro でライト / ダークモードの切り替えが可能に
- 設定から再生方法を変更可能に
- チャンネル閲覧に対応（テスト段階）
- ゲームを6つ追加

### ver1.1.0
- 複数のゲームを追加
- MIN-Tube-Pro のホーム画面を見やすく変更

### ver1.0.4
- コメントが表示されないバグを修正
- Youtube-search-api で動画IDを検索し、タイトルとチャンネル名を取得する方式に変更

### ver1.0.3
- タイトルとチャンネル名の取得を自動化し、読み込みを高速化

### ver1.0.2
- siawaseok 様の API と MIN-Tube2 の API を `Promise.any()` で並列取得する方式に変更
- どちらかの API が落ちていても取得できるため、Invidious 依存を排除し、動画メタデータ取得の成功率が大幅に向上

### ver1.0.1
- YouTubeEducation の埋め込みパラメータを woolisbest 様と siawaseok 様の GitHub リポジトリから自動取得する方式に変更
- 手動管理が不要になり、常に最新の Education 用パラメータを反映可能に

---

## 技術詳細

### Elixir-Network について
rhenryw が作成した embeddr という静的なプロキシです。UV の bare サーバーは使わず、ランマーヘッドや Scamjet に近い Wisp というサーバーを使用しています。多くのサーバーを経由するため、今のところ落ちる心配がありません。

- サーバー: `wss://wisp.rhw.one/` に接続できた場合のみ YouTube 動画を再生可能
- エンドポイント: `/embed.html#URL` （`/proxy/embed.html#URL`）であらゆるウェブサイトの検閲を回避できます

#### 開発者向け 技術的な概要
静的なプロキシは多くの場合、コード内で直接ルートを指定し、そのままのパスでファイルへ接続します。そのため、自分のプロジェクトにプロキシを追加しようとすると `Cannot get error` が発生することがあります。これを回避するには、`index.js` 側でパスを書き換え、正しいディレクトリ内のファイルを返すように指示する必要があります。

MIN-Tube-Pro では以下のような技術を使用しています。

```js
const PROXY_ENDPOINTS = [
  'prxy',
  'baremux',
  'epoxy',
  'libcurl',
  'register-sw.mjs',
  'uv'
];
app.use('/proxy', express.static(PROXY_DIR));

app.use((req, res, next) => {
  const fileName = req.path.replace(/^\//, '');

  if (PROXY_ENDPOINTS.includes(fileName)) {
    const targetPath = path.join(PROXY_DIR, fileName);

    if (fs.existsSync(targetPath) && fs.lstatSync(targetPath).isFile()) {
      return res.sendFile(targetPath);
    }
  }

  next();
});
```

エンドポイントを絞って関数を制限することで、サーバー負荷を減らせます。

### Abyss V5 について
もともとは jacksoncraft859 が作成した静的な UV プロキシです。bare サーバーが動かなくなっていたため、dinguschan-owo のサーバーを組み込んで再構成しました。デザインやバグ修正は MIN-Tube-Pro に搭載するために改変されています。  
このプロキシを単体で利用したい場合は、以下のリポジトリを推奨します。  
https://github.com/mino-hobby-pro/UV-Static_Netlify

---
## 開発メンバー

・<a href="https://github.com/woolisbest-honke">woolisbest</a>  
・<a href="https://github.com/mino-hobby-pro">mino</a>  
・<a href="https://github.com/myproxy0108-prog">ねむい</a>  
・<a href="https://github.com//raku-ringo">raku-ringo</a>  
・<a href="https://github.com/Sou930">Sou930</a>  
・<a href="https://github.com/KA1121Studio">KA1121Studio</a>  
・<a href="https://github.com/kiki riki">kiki riki</a>  

---

## 謝辞

以下の開発者・プロジェクトに感謝します。

- mino-hobby-pro
- dinguschan-owo
- jacksoncraft859
- siawaseok
- その他、本プロジェクトを支えてくださったすべての方々

---

<div align="center">

### Min-WLYT-Plus™

© 2026 <a href="https://github.com/woolisbest-honke">woolisbest</a>
All rights reserved.

</div>
