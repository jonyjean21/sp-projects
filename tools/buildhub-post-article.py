#!/usr/bin/env python3
"""BuildHub 体験談記事投稿スクリプト"""
import requests, base64, json, sys, os

WP_SITE = "https://buildhub.jp"
WP_USER = os.environ.get("BUILDHUB_WP_USER", "buildhub260309")
WP_APP_PASS = os.environ.get("BUILDHUB_WP_APP_PASS", "")
PEXELS_KEY = os.environ.get("PEXELS_API_KEY", "")

token = base64.b64encode(f"{WP_USER}:{WP_APP_PASS}".encode()).decode()
headers = {"Authorization": f"Basic {token}", "Content-Type": "application/json"}

def get_pexels_image(query):
    r = requests.get(
        "https://api.pexels.com/v1/search",
        headers={"Authorization": PEXELS_KEY},
        params={"query": query, "per_page": 1, "orientation": "landscape"}
    )
    photos = r.json().get("photos", [])
    if not photos:
        return None
    return photos[0]["src"]["medium"], photos[0]["photographer"], photos[0]["url"]

def upload_image(img_url, filename, alt):
    img_data = requests.get(img_url).content
    r = requests.post(
        f"{WP_SITE}/wp-json/wp/v2/media",
        headers={
            "Authorization": f"Basic {token}",
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "image/jpeg"
        },
        data=img_data
    )
    if r.status_code in (200, 201):
        media_id = r.json()["id"]
        # alt text
        requests.post(f"{WP_SITE}/wp-json/wp/v2/media/{media_id}",
            headers=headers, json={"alt_text": alt})
        return media_id
    return None

TITLE = "Claude Codeだけでメディアを全自動運営してみた話——BuildHub構築記"
SLUG  = "buildhub-claude-code-story"
EXCERPT = "このサイト（BuildHub）は、私がコードをほぼ書かずにClaude Codeと会話するだけで構築・運営しています。情報収集→記事生成→WordPressへの自動投稿まで全自動。その仕組みと、やってみてわかったことを全部公開します。"

CONTENT = """
<p>このサイト（BuildHub）は、<strong>私がコードをほぼ書かずに作りました</strong>。</p>

<p>正確には、コードを書いてはいます——でも全部Claude Codeが書いています。私がやっているのは「こういうシステムを作って」と会話することだけ。2026年3月、ゼロから約1日でメディアを立ち上げ、今では毎朝7時に自動で記事が公開されています。</p>

<p>今日は、その仕組みと、実際に作ってみてわかったことを全部公開します。</p>

<hr>

<h2>BuildHubとは何か</h2>

<p>BuildHubは「Claude CodeをはじめとするAI開発ツールの最新情報を日本語で届けるメディア」です。</p>

<p>英語圏では毎日大量の情報が流れています——Hacker News、Reddit、GitHub、dev.to。でも日本語でそれをキャッチアップするメディアはまだほぼない。そのギャップを埋めようと作りました。</p>

<p>そしてもう一つの動機があります。<strong>「BuildHub自体がClaude Codeで作られている」という事実を示すこと</strong>です。使い方を語るより、動いているものを見せるほうが説得力がある。</p>

<hr>

<h2>全体アーキテクチャ</h2>

<p>システムの全体像はこうなっています。</p>

<pre>
【収集層】
Reddit r/ClaudeAI, r/ClaudeCode
Hacker News
Zenn / Qiita / dev.to
GitHub Releases RSS
X（IFTTT経由）
   ↓ GAS（6時間おき）
【キュー】Firebase Realtime Database
   ↓ スコアリング（海外ソース加点 / コード有加点など）
【生成層】Gemini 2.5 Flash（要約・日本語記事生成）
   ↓ ConoHa WING 内PHPクーロン（毎朝7時JST）
【公開層】WordPress（BuildHub）
</pre>

<p>各レイヤーをClaude Codeとの会話だけで設計・実装しました。使ったサービスはすべて既存のもの（Firebase、GAS、ConoHa WING、Gemini API）。新しくサーバーを立てるようなことは一切していません。</p>

<hr>

<h2>Claude Codeが担っている役割</h2>

<h3>① コードを書く</h3>

<p>GASのコレクタースクリプト、Pythonのダイジェスト生成ツール、PHPのクーロン処理——これらはすべてClaude Codeが書いています。私がやったのは「こういう動作をするスクリプトを作って」と伝えることだけ。</p>

<h3>② 運用ルールを覚える（CLAUDE.md）</h3>

<p>Claude Codeには <code>CLAUDE.md</code> というファイルがあります。これはClaudeへの「永続的な指示書」です。私はここに以下のようなことを書いています。</p>

<ul>
  <li>どのサービスにどう認証するか（WP、Firebase、Gemini）</li>
  <li>記事品質の基準（アイキャッチ・スラッグ・タグ必須）</li>
  <li>セキュリティルール（.envは絶対コミットしない、など）</li>
  <li>コミットしたら毎回pushする、などの鉄則</li>
</ul>

<p>毎回ゼロから指示しなくていい。CLAUDE.mdに書いておけば、Claudeはそれを前提に動きます。</p>

<h3>③ セッションをまたいで記憶する（sp-brain）</h3>

<p>Claude Codeはセッションをまたぐと記憶がリセットされます。それを補うために、私は <code>sp-brain/</code> というディレクトリを作り、長期記憶・週次状態・意思決定ログを保存しています。</p>

<p>セッション開始時にClaude Codeがそのファイルを読んで「前回の続き」から始められるようにする——これだけで、AIアシスタントの継続性が劇的に上がります。</p>

<h3>④ スキル（再利用可能なコマンド）</h3>

<p><code>.claude/skills/</code> に定型作業の手順書をMarkdownで置いています。「大会情報を投稿する」「週次まとめを生成する」など、繰り返し実行する処理はスキルとして定義。<code>/tournament</code> と打つだけで全手順を自動実行します。</p>

<h3>⑤ フック（自動トリガー）</h3>

<p>セッション開始時にシェルスクリプトが自動実行され、Firebaseのキューを確認→未処理があれば自動でスキルを呼び出す仕組みになっています。私が「処理して」と言わなくても、Claude Codeが起動した瞬間に状況を把握して動き始めます。</p>

<hr>

<h2>やってみてわかった3つのこと</h2>

<h3>1. CLAUDE.mdは「育てるもの」</h3>

<p>最初から完璧なCLAUDE.mdは書けません。作業しながら「あ、これも書いておくべきだった」と気づいたことを追記し続けることで、徐々に精度が上がっていきます。今の私のCLAUDE.mdは3ヶ月かけて育てたものです。</p>

<h3>2. 「全部Claude Codeに任せる」は危うい</h3>

<p>Claudeは優秀ですが、確認なしに動くと予想外のことをします。本番DBを操作する・ファイルを削除するといった「取り返しのつかない操作」の前には必ず確認を挟むルールをCLAUDE.mdに書いておくことが重要です。</p>

<h3>3. 小さく始めて即公開が正解</h3>

<p>BuildHubは最初、WordPressを立てただけの状態でした。そこから「GASでキュー収集」→「Geminiで要約」→「PHPで自動投稿」と少しずつ拡張しました。全部揃ってから公開しようとすると永遠に公開できない。70点で出して改善するのがAI開発の鉄則です。</p>

<hr>

<h2>これからやること</h2>

<p>自動化の仕組みはできました。次は「<strong>SPの一次情報</strong>」を増やすフェーズです。</p>

<p>自動生成記事はどのメディアも作れます。でも「実際にこのシステムを動かしている人間の体験談」は唯一無二です。Claude Codeで何かを作るたびに、その話をここに書いていきます。</p>

<p>ニュースレターも近日開始予定。週1回、厳選した情報＋筆者コメントをメールでお届けします。興味ある方はサイトをブックマークしておいてください。</p>

<hr>

<p><em>このサイトはClaude Codeと筆者の会話から生まれています。ご意見・ご感想はお問い合わせページからどうぞ。</em></p>
"""

def main():
    dry_run = "--dry-run" in sys.argv

    # アイキャッチ画像
    featured_media = None
    if not dry_run and PEXELS_KEY:
        print("Pexels画像取得中...")
        result = get_pexels_image("AI coding developer keyboard terminal")
        if result:
            img_url, photographer, photo_url = result
            print(f"  画像: {photographer} / {photo_url}")
            media_id = upload_image(img_url, "buildhub-story.jpg", "Claude Codeで開発するエンジニア")
            if media_id:
                featured_media = media_id
                print(f"  アップロード完了: media_id={media_id}")

    payload = {
        "title": TITLE,
        "slug": SLUG,
        "content": CONTENT,
        "excerpt": EXCERPT,
        "status": "publish",
        "categories": [2],      # Claude Code
        "tags": [6, 12, 13],    # Claude Code, AI開発, Anthropic
    }
    if featured_media:
        payload["featured_media"] = featured_media

    if dry_run:
        print("[DRY RUN] 投稿内容:")
        print(f"  タイトル: {TITLE}")
        print(f"  スラッグ: {SLUG}")
        print(f"  カテゴリ: Claude Code(2)")
        print(f"  タグ: Claude Code(6), AI開発(12), Anthropic(13)")
        print(f"  文字数: {len(CONTENT)}文字")
        return

    # スラッグ重複チェック
    r = requests.get(f"{WP_SITE}/wp-json/wp/v2/posts", params={"slug": SLUG})
    if r.json():
        print(f"スラッグ '{SLUG}' は既に存在します。スキップ。")
        return

    print("WordPressに投稿中...")
    r = requests.post(f"{WP_SITE}/wp-json/wp/v2/posts", headers=headers, json=payload)
    if r.status_code in (200, 201):
        post = r.json()
        print(f"✅ 投稿完了!")
        print(f"  ID: {post['id']}")
        print(f"  URL: {post['link']}")
    else:
        print(f"❌ エラー: {r.status_code}")
        print(r.text[:500])

if __name__ == "__main__":
    main()
