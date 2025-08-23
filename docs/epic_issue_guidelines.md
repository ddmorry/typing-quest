# Epic & Issue Guidelines（Typing RPG プロジェクト）

---

作成日: 2025-08-23（Asia/Phnom_Penh）
対象: MVP → v1.0 期間
適用範囲: Linear（推奨）/ GitHub Issues（併用可）

---

1. 目的
	•	スリム開発を前提に、PRD/Roadmap/RFC から Epics と Issues を一貫した形式で起票するルールを定める。
	•	横断要件（計測/パフォ/QA）は独立WSにしない。各Issueの AC（受入基準）に1行で内包する。

---

1. 参照ドキュメント（出典の順序）
	1.	Roadmap（スリム版）: /docs/roadmap.md … 目的・KPI・マイルストーン・タイムライン
	2.	PRD: /docs/prd.md … 体験設計・ゲームロジック・データモデル・API・受入基準
	3.	RFC-0001 Architecture: /docs/rfc/0001-architecture.md … 技術境界・フロー・IF
	4.	OpenAPI/DDL: /docs/api/openapi.yaml, supabase/ddl.sql … 契約とスキーマ

エピックは Roadmap §3（WS） と PRD/RFCの該当章を出典に、Issue は Roadmap §4（タイムライン） を出典として起票する。

---

2. 命名・ラベル・接頭辞
	•	Epic名: EPIC-0X: <短い成果名> 例: EPIC-01: ゲームエンジン（Phaser Adapter + HUD）
	•	Issueタイトル: [feat|fix|chore|perf|a11y|docs](領域) 具体アクション
例: [feat(engine)] 二択ロック動作を実装（攻撃/回復）
	•	ラベル（例）: engine, ui, api, db, telemetry, perf, a11y, security, docs
	•	コミット規約: Conventional Commits（例: feat(engine): implement word lock）

---

3. Epic の作り方

3.1 フレーム

# EPIC-0X: タイトル
目的（Why）: （Roadmap §0/§4から）
成果指標（KPI）: （RoadmapのKPIから必要部分のみ）
範囲（In）: （PRD/RFCの要件を箇条書き）
範囲（Out）: （MVP外の明記）
受入基準（AC）:
- （PRD §17 ほか数値/チェック）
- （横断内包）Phaserは`/game`のみで遅延読込 / 計測3イベント保存 / ユニット緑
依存関係: （別EpicやDDL/OpenAPIなど）
出典: Roadmap §? / PRD §? / RFC §?

3.2 推奨エピック（3本）
	•	EPIC-01 エンジン（Phaser Adapter + HUD + 戦闘ロジック）
出典: Roadmap §3, §4 Sprint1 / PRD §5, §7.3, §11, §26 / RFC §4.2, §5, §6, §9
	•	EPIC-02 UI/設定（Next.js + shadcn/ui + i18n最小）
出典: Roadmap §3, §4 / PRD §4, §7.2, §27 / RFC §4.1, §10, §3
	•	EPIC-03 API/DB（Supabase + Route Handlers）
出典: Roadmap §3, §4 Sprint2 / PRD §8, §9, §25, §14 / RFC §7, §8

---

4. Issue の作り方（タイムライン駆動）
	•	原則: Roadmap §4（Sprint別ゴール）から分解して起票。
	•	サイズ: 0.5〜1.5日で終わる粒度（大きければ分割）。
	•	DoR（Ready条件）: 出典リンク、AC、依存の明記。
	•	DoD（Done条件）: AC満たす、型/リンタ0、必要なら動画/スクショ、CHANGELOG更新。

4.1 Issue テンプレ（Linear）

Title: [feat(engine)] 二択ロック動作を実装（攻撃/回復）
Epic: EPIC-01 エンジン
AC:
- 最初に正打した側のみ継続、他方は無効化（灰色）
- 誤打でコンボ0、再提示でロック解除
- （横断）ユニットテスト緑（lock/unlock/再提示）
出典: Roadmap §4 Sprint1 / PRD §11.1 / RFC §6.1
依存: GameAdapter IF が先行
備考: スモーク動画を添付

4.2 Issue テンプレ（GitHub）

## Summary
二択ロック動作（攻撃/回復）を実装

## Acceptance Criteria
- 正打側のみ継続、他方は無効化
- 誤打でコンボ0、再提示でロック解除
- （横断）ユニット緑

## References
- Roadmap §4 Sprint1
- PRD §11.1, §26
- RFC §6.1

## Dependencies
- GameAdapter IF (#123)


---

5. 横断要件の“内包”ルール（1行で十分）
	•	計測: session_start / attempt_commit / session_end を保存（SQLで確認できる）
	•	パフォ: Phaserは /game のみで dynamic import（ssr:false）
	•	QA: combat数式/ロックのユニットが緑、手動スモーク通過

これらは専用WSを作らない。各IssueのACに1行追加するだけ。

---

6. ステータスフロー（推奨）

Epic
	•	Draft → In Progress → Code Freeze（MVP）→ Released → Archived

Issue
	•	Todo → In Progress → Review → Done（ブロック時は Blocked）

---

7. スプリントごとのサンプル起票

Sprint 0（準備）
	•	EPIC-01: [chore(engine)] /game CSR island を作成し Phaser を遅延読込
	•	EPIC-02: [chore(ui)] Next.js 初期化 + レイアウト雛形
	•	EPIC-03: [feat(db)] supabase/ddl.sql を適用（RLS最小）
	•	EPIC-03: [docs(api)] openapi.yaml に /session|/attempt|/session/end を下書き

Sprint 1（コアループ）
	•	EPIC-01: [feat(engine)] GameAdapter IF を実装
	•	EPIC-01: [feat(engine)] 二択ロック（攻撃/回復）
	•	EPIC-01: [feat(engine)] combat計算（dmg/heal/guard）+ユニット
	•	EPIC-01: [feat(engine)] 敵テレグラフ→ガード軽減
	•	EPIC-02: [a11y(ui)] フォーカス維持と可視リング（最小）

Sprint 2（結線）
	•	EPIC-03: [feat(api)] /api/session を実装
	•	EPIC-03: [feat(api)] /api/attempt を実装
	•	EPIC-03: [feat(api)] /api/session/end を実装
	•	EPIC-02: [feat(ui)] 結果画面（数字カード）
	•	EPIC-02: [feat(ui)] 設定画面（パック/難易度/主要A11y）
	•	EPIC-03: [telemetry] 3イベント保存（同期）

---

8. 依存関係とブロッキングの扱い
	•	依存は Issue冒頭に 依存: を1行。レビュー時に必ず確認。
	•	ブロックが発生したら Roadmap §6（スコープ調整ルール） に従い“削る順”で対処。

---

9. 見積もり（軽量）
	•	T-shirt size（XS=半日, S=1日, M=2日, L=3日〜）。
	•	バーンダウンは不要。スプリントレビュー時に 実績 vs 見積りの差だけ振り返る。

---

10. 変更管理（ADR/RFC）
	•	アーキ/契約に影響する変更は ADR を追加（/docs/adr/）。
	•	大きな構造変更は RFC をDraftに戻す or 新規RFCを起案。

---

11. チェックリスト（起票担当者向け）
	•	出典リンクを貼った（Roadmap/PRD/RFC）
	•	ACは検証可能な文になっている
	•	横断要件を1行で内包した
	•	依存Issueを1行で明記した
	•	サイズはS〜Mに収まる

---

12. 付録：サンプルEpic（完成形）

# EPIC-01: ゲームエンジン（Phaser Adapter + HUD）
目的: コアループ（攻撃/回復の二択 + ガード）を60fpsで安定実行
成果指標: 初回セッション長≥6分、Accuracy中央値≥90%
範囲（In）: GameAdapter, PhaserAdapter, HUD連携, combat式, 敵テレグラフ/ガード
範囲（Out）: 連戦/装備/ランキング/PWA/詳細アニメ
受入基準（AC）:
- /gameで攻撃/回復/ガードの一連が通る（PRD §17）
- combat式のユニット緑（単調性/境界）
- （横断）Phaserは /game のみで dynamic import（ssr:false）
依存関係: RFC-0001 確定、GameAdapter IF、combatユーティリティ
出典: Roadmap §3, §4 Sprint1 / PRD §5, §7.3, §11, §26 / RFC §4.2, §5, §6, §9


---

13. 付録：サンプルIssue（完成形）

Title: [feat(api)] POST /api/attempt を実装
Epic: EPIC-03 API/DB
AC:
- OpenAPI通りのバリデーション（zod）
- RLS下で session_id 所有者のみINSERT可能
- （横断）計測: attempt_commit がDBで確認できる
出典: Roadmap §4 Sprint2 / PRD §9, §25 / RFC §7
依存: supabase/ddl.sql 適用 (#234)