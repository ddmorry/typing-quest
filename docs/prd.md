# タイピングRPG（ブラウザ）PRD v1.0

最終更新: 2025-08-23
作成者: あなた（+ ChatGPT）
対象リリース: MVP（ベータ公開） → v1.0（一般公開）

---

## 1. 目的 / ビジョン

英語学習者（特にタイピング練習を必要とする初中級者）が、**ゲーム的リテンション**（レベル・戦闘・報酬）と**即時フィードバック**（正誤・スピード・コンボ）を通じて、「正確さと速度」を楽しく反復できるタイピングRPGを提供する。

- **学習成果目標**: 10分プレイで WPM +5 / 正答率 +3% を平均的に狙う。
- **ゲーム体験**: ドラゴンクエスト風のターン制×リアルタイム要素。
- **運用目標**: 1ユーザーあたり週3回・各10分のアクティブ継続。

---

## 2. スコープ

### 2.1 In Scope（MVP）

- シングルバトル（1主人公 vs 1モンスター）
- 攻撃/回復の二択入力（左右2語）
- ガード（敵攻撃時の防御入力）
- 単語パック選択・難易度設定・セッション集計
- ゲストプレイ（ログは匿名）+ ログインユーザーの保存
- 結果画面・ダッシュボード（直近と累積の基本統計）

### 2.2 Out of Scope（MVP外/将来）

- 章立て/マップ/連戦・装備・スキルツリー
- PVP/ランキング
- 本格PWA/オフライン同期（v1.2候補）

---

## 3. ターゲット / ペルソナ

- EFL学習者（高校〜大人）: 単語タイピング基礎を強化したい。
- ディスレクシア傾向のある学習者: 高コントラスト・読み上げ・フォント選択を重視。
- 教員/保護者: 生徒の練習用に安全・記録可能なツールを探している。

---

## 4. 体験設計

### 4.1 主要画面

1. ランディング（SSR/SSG）
   - ゲーム概要、SEO対応、OG画像表示
   - 「今すぐ遊ぶ（ゲスト）」「ログイン」CTA

2. 設定（SSR/RSC + クライアント）
   - 単語パック選択（NGSL・TOEIC基礎等）
   - 難易度（EASY/NORMAL/HARD）
   - 時間制限/バトル長（例: 3・5・10分）
   - A11y: 高コントラスト/低刺激/OpenDyslexic/読み上げON/OFF

3. ゲーム（CSR島: `/game`）
   - 左: 主人公、右: モンスター
   - 画面中央下: **左右2つの単語**（左=回復、右=攻撃）
   - 上部HUD: HPバー（双方）、コンボ、正確率、WPM、残り時間
   - 敵攻撃テレグラフ（カウントダウン）

4. 結果
   - 正答率、平均WPM、コンボ最長、攻撃/回復成功数、被ダメ/与ダメ、ガード成功率
   - 次の学習提案（苦手カテゴリ）

5. ダッシュボード（保護ページ）
   - 週次の推移、累積、パック別成績

6. ログイン/プロフィール
   - Supabase Auth（Email/Pass, OAuth任意）

### 4.2 入力UX

- キー入力は **即時判定**（1打鍵=1判定）
- **非対象キー無視**（Tab/Alt等）
- **Backspace無効（MVP）**: 誤字は攻撃/防御力に反映しつつ、続行。
- IME入力はガード（英字のみ許可）。
- 片方の単語をタイプ開始した時点で **もう一方はロック**（選択確定）。

### 4.3 A11y / Dyslexiaフレンドリー

- Tailwind + shadcn/ui（Radix）でフォーカスリング/ARIA/ショートカット
- 高コントラストテーマ、**OpenDyslexic**等のフォント切替
- 単語の **文字間隔増し** オプション
- 敵攻撃の **視覚 + 音** テレグラフ（音量調整）
- アニメーションは「低減モード」対応

---

## 5. ゲームデザイン

### 5.1 バトルフロー

1. プレイヤーターン（常時）
   - 画面に2語（左=回復w_h、右=攻撃w_a）
   - いずれかをタイプ完了 → 該当コマンド実行

2. 敵攻撃（一定間隔 or HPトリガー）
   - ガード語 w_g 提示 + カウントダウン T_g（例2.5s）
   - 入力の正確度/速度で被ダメ軽減

### 5.2 ダメージ/回復/防御の数式（MVP）

- 記号
  - `L`: 語のレベル（1=易〜5=難）
  - `len`: 文字数
  - `err`: タイプ中のミス数
  - `acc`: 正確率 = 正打 / (正打 + err)
  - `spd`: その語のWPM（語長と所要時間から計算）
  - `combo`: 連続正解数（ミスで0）

- 攻撃ダメージ `DMG`

  ```
  base = 5 + 0.8*L + 0.2*len
  penalty = max(0.4, 1 - 0.15*err)
  comboBoost = 1 + min(0.5, combo*0.05)
  speedBoost = 1 + clamp((spd-35)/65, 0, 0.3)  // 35WPM基準
  DMG = round(base * penalty * comboBoost * speedBoost)
  ```

- 回復量 `HEAL`

  ```
  base = 4 + 0.6*L + 0.15*len
  penalty = max(0.5, 1 - 0.12*err)
  speedBoost = 1 + clamp((spd-30)/70, 0, 0.25)
  HEAL = round(base * penalty * speedBoost)
  ```

- ガード軽減率 `GR`

  ```
  base = 0.35 + 0.05*L
  accFactor = clamp(acc, 0.2, 1)
  speedFactor = 1 + clamp((spd-30)/60, -0.1, 0.2)
  GR = clamp(base * accFactor * speedFactor, 0.1, 0.85)  // 10〜85%
  被ダメ = round(敵ATK * (1 - GR))
  ```

### 5.3 難易度

- EASY: 敵ATK低/攻撃間隔長/T_g長/語はL1-2中心
- NORMAL: 標準
- HARD: 敵ATK高/攻撃間隔短/T_g短/語はL3-5中心、コンボ減衰厳しめ

### 5.4 失敗時/中断

- HP0で敗北、勝利条件は「制限時間内に敵HP0」
- Pause（Esc）: 時間停止、入力無効

---

## 6. 非機能要件

- FPS目標: 60（最低30）
- 初回ロードJS（非`/game`）: < 120KB gzip
- `/game` 追加ロード: < 400KB gzip（Phaser遅延読込）
- TTFB < 200ms（Vercel想定）
- A11y: WCAG AA 準拠を目標
- i18n: 日本語/英語（`next-intl`想定）

---

## 7. アーキテクチャ

### 7.1 技術スタック

- **Next.js（App Router）**: ランディング/設定/結果/ログイン/ダッシュボード（SSR/SSG/RSC）
- **/game**: クライアント専用ルート（CSR island）

  ```tsx
  // app/game/page.tsx
  'use client';
  import dynamic from 'next/dynamic';
  const GameCanvas = dynamic(() => import('@/features/game/GameCanvas'), {
    ssr: false,
  });
  export default function GamePage() {
    return <GameCanvas />;
  }
  ```

- **UI**: React + TS + Tailwind + shadcn/ui（Radix）
- **状態管理**: Zustand（UI/HUD/設定/セッション境界）
- **ゲームランタイム**: Phaser 3（Arcade Physics）
- **データ/認証**: Supabase（Auth/Postgres/Storage/RLS）

### 7.2 コンポーネント/状態（概略）

- `app/(marketing)/page.tsx` ランディング
- `app/settings/page.tsx` 設定
- `app/game/page.tsx` ゲーム
  - `features/game/GameCanvas.tsx`（Phaserマウント）
  - `features/game/HUD.tsx`（Zustand購読）

- `app/results/page.tsx` 結果
- `app/dashboard/page.tsx` ダッシュボード（保護）

### 7.3 GameAdapter 抽象

将来のレンダラ差替に備え、**ゲームロジックをUI/状態から分離**。

```ts
export interface GameAdapter {
  mount(el: HTMLDivElement, cfg: GameConfig): void;
  start(session: SessionSeed): void;
  pause(): void;
  resume(): void;
  destroy(): void;
  on(event: GameEvent, cb: (p: any) => void): () => void; // unsubscribe
}
```

Phaser実装例 `PhaserAdapter` は内部で `Phaser.Game` と `Scene` を管理。HUD更新は EventBus → Zustand 経由。

### 7.4 Zustand ストア設計（抜粋）

```ts
// settingsStore
{
  packId: string; difficulty: 'EASY'|'NORMAL'|'HARD'; durationSec: 300;
  a11y: { highContrast: boolean; openDyslexic: boolean; reduceMotion: boolean; tts: boolean };
}

// sessionStore（ランタイム）
{
  state: 'IDLE'|'RUNNING'|'PAUSED'|'ENDED';
  hp: { player: number; enemy: number };
  hud: { wpm: number; acc: number; combo: number; timeLeft: number };
  currentWords: { heal: Word; attack: Word; guard?: Word; locked: 'heal'|'attack'|null };
}
```

---

## 8. データモデル（Supabase）

### 8.1 テーブル定義（SQL）

```sql
-- profiles
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

-- word_packs
create table if not exists public.word_packs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  lang text not null default 'en',
  level_min int2 default 1,
  level_max int2 default 5,
  tags text[] default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- words（1語=1行）
create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid references public.word_packs(id) on delete cascade,
  text text not null,
  level int2 not null check (level between 1 and 5),
  length int2 generated always as (char_length(text)) stored
);
create index on public.words(pack_id);

-- sessions（1プレイ）
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id), -- null=ゲスト（匿名Cookieで後日紐付け可）
  pack_id uuid references public.word_packs(id),
  difficulty text not null check (difficulty in ('EASY','NORMAL','HARD')),
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_sec int2,
  result text check (result in ('WIN','LOSE','ABORT')),
  stats jsonb -- {wpm,acc,comboMax,atkCount,healCount,guardRate,damage,damageTaken}
);
create index on public.sessions(user_id);

-- attempts（1語ごとのログ）
create table if not exists public.attempts (
  id bigserial primary key,
  session_id uuid references public.sessions(id) on delete cascade,
  type text not null check (type in ('ATTACK','HEAL','GUARD')),
  word_id uuid references public.words(id),
  target_text text not null,
  ms int not null, -- 入力所要ミリ秒
  errors int not null default 0,
  wpm numeric(5,2) generated always as (case when ms>0 then (char_length(target_text)::numeric / 5) / (ms::numeric/60000) else 0 end) stored,
  accuracy numeric(5,4) not null default 1.0,
  score int,
  created_at timestamptz default now()
);
create index on public.attempts(session_id);

-- 集計ビュー
create view public.session_summary as
select s.id as session_id, s.user_id, s.pack_id, s.difficulty,
       coalesce((s.stats->>'wpm')::numeric, avg(a.wpm)) as avg_wpm,
       coalesce((s.stats->>'acc')::numeric, avg(a.accuracy)) as avg_acc,
       sum(case when a.type='ATTACK' then a.score else 0 end) as total_damage,
       count(*) filter (where a.type='HEAL') as heals,
       count(*) filter (where a.type='ATTACK') as attacks
from public.sessions s
left join public.attempts a on a.session_id = s.id
group by s.id;
```

### 8.2 RLS ポリシー

```sql
alter table public.sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.profiles enable row level security;

-- セッション/アテンプト: 自分のものだけ
create policy "sessions_select_own" on public.sessions for select
  using (auth.uid() = user_id);
create policy "sessions_insert_own" on public.sessions for insert
  with check (auth.uid() = user_id or user_id is null);
create policy "attempts_select_via_session" on public.attempts for select
  using (exists (select 1 from public.sessions s where s.id = session_id and (s.user_id = auth.uid() or s.user_id is null)));
create policy "attempts_insert_via_session" on public.attempts for insert
  with check (exists (select 1 from public.sessions s where s.id = session_id and (s.user_id = auth.uid() or s.user_id is null)));

-- プロフィール: 自分のみ
create policy "profiles_self" on public.profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

> 備考: ゲストセッションは `user_id is null` で作成。後日ログイン時に**所有権の移譲API**で紐付け（Cookie/ローカルID一致時）。将来対応。

---

## 9. API / ルートハンドラ（Next.js）

```ts
// POST /api/session
// ボディ: { packId, difficulty, settingsSnapshot }
// 返却: { sessionId }

// POST /api/attempt
// ボディ: { sessionId, type, wordId, targetText, ms, errors, accuracy, score }

// POST /api/session/end
// ボディ: { sessionId, result, durationSec, stats }

// GET /api/dashboard/summary  // 認証必須
```

Edge: Supabase JS（Service Roleは使わず、RLS前提）。

---

## 10. コンテンツ（単語パック）

- `word_packs`: タイトル/難易度帯/タグ
- `words`: 単語本文 + level（L1-L5）
- インポート: CSV（`text,level`）。管理ツールはダッシュボードv1.1で。
- ランダム供給: 現在の難易度に応じたL帯域から均等サンプリング。

---

## 11. ロジック詳細

### 11.1 語の提示と選択

- 毎ターン `healWord` と `attackWord` を生成。
- 最初の正しいキー入力で「ロック」→ 反対語は灰色/無効。
- 完了/タイムアウト/敵攻撃発生で再提示。

### 11.2 敵AI（MVP）

- 基本ATK: 14（難易度でスケール）
- 攻撃間隔: 6s / 4.5s / 3.5s（E/N/H）
- 攻撃前テレグラフ: 2.5/2.0/1.5s（E/N/H）

### 11.3 スコアリング

- 与ダメ合計、回復合計、ガード軽減合計
- コンボ: ミスで0、成功で+1（上限100）

---

## 12. セキュリティ/プライバシー

- 個人情報最小化（メールのみ）
- Supabase RLSで行単位保護
- クライアント送信データは必要最小（生キーストロークは送らない）
- 監査: 重要APIに rate limit（middleware）

---

## 13. パフォーマンス / 最適化

- Phaserは `/game` のみ `next/dynamic({ ssr:false })` で遅延読込
- `@vercel/og` でOG画像をエッジ生成（他ページはSSG）
- 画像/音声は `next/image` + Supabase Storage（public bucket）
- RSCで設定画面の静的データ（パック一覧）をストリーミング

---

## 14. ログ / テレメトリ（Supabase）

- `sessions` 行に `stats` JSON（wpm/acc/guardRate 等）
- `attempts` に1語ごとの `ms/errors/score/wpm/accuracy`
- 重要イベント（pause/resume/abort）も attempts に type拡張で記録可

---

## 15. テスト計画

- 単体: 数式（DMG/HEAL/GR）、ワード選択ロック、コンボ
- 生成的テスト: ランダム入力でメトリクス分布が範囲内
- E2E: Playwright（攻撃/回復/ガード成功ケース）
- アクセシビリティ監査: @axe-core/playwright

---

## 16. リリース計画

- **MVP**（2-3週間想定）
  - シングルバトル、2語選択、ガード、結果、ダッシュボード簡易

- **v1.0**
  - 難易度調整、語パック管理、A11y拡充、i18n英語

- **v1.1**
  - ゲスト→ログイン時のセッション移譲、ダッシュボード強化、PWA準備

---

## 17. 受け入れ基準（MVP）

- [ ] `/` で概要/OG画像が表示される
- [ ] `/settings` でパックと難易度が選べる
- [ ] `/game` で左右2語が常時表示され、入力開始で一方がロックされる
- [ ] 正確にタイプ完了で攻撃/回復が実行される
- [ ] 敵攻撃のカウントダウンがあり、ガード語をタイプで軽減できる
- [ ] 結果画面でWPM/正確率/コンボ等が表示される
- [ ] ログイン時は `sessions/attempts` が自分だけ閲覧可能（RLS有効）

---

## 18. 実装メモ / 擬似コード

```ts
// ダメージ計算ユーティリティ
export function calcDamage({
  L,
  len,
  err,
  spd,
  combo,
}: {
  L: number;
  len: number;
  err: number;
  spd: number;
  combo: number;
}) {
  const base = 5 + 0.8 * L + 0.2 * len;
  const penalty = Math.max(0.4, 1 - 0.15 * err);
  const comboBoost = 1 + Math.min(0.5, combo * 0.05);
  const speedBoost = 1 + clamp((spd - 35) / 65, 0, 0.3);
  return Math.round(base * penalty * comboBoost * speedBoost);
}

// ガード軽減
export function calcGuard({
  L,
  acc,
  spd,
}: {
  L: number;
  acc: number;
  spd: number;
}) {
  const base = 0.35 + 0.05 * L;
  const accFactor = clamp(acc, 0.2, 1);
  const speedFactor = 1 + clamp((spd - 30) / 60, -0.1, 0.2);
  return clamp(base * accFactor * speedFactor, 0.1, 0.85);
}
```

---

## 19. デザイン指針

- 視認性最優先（大きめ文字、行間、強いコントラスト）
- 戦闘中は**入力欄にフォーカス固定**
- 成功時は短いフィードバック（音/エフェクト）

---

## 20. リスク / 対応

- 入力メソッド差（IME）: 英字固定/非許可で回避
- ラグ/低FPS: 演出は最小限、低減モードでアニメ削減
- 不正（オートタイパー）: 人間らしさヒューリスティクス（反応時間分布、エラーパターン）を後日導入

---

## 21. 追加事項（将来）

- 連戦/ステージ、簡易スキル（「回復強化」など）
- 教員向けクラスルーム（共有パック、クラス統計）
- 音声読み上げ（Web Speech API）や、単語の例文表示

---
