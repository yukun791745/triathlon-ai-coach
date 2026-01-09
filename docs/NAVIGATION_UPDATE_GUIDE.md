# 全ページ ナビゲーション更新ガイド

## 更新が必要なファイル

以下のファイルのナビゲーション部分を更新する必要があります：

1. home.html
2. index.html
3. news.html
4. race-selection.html
5. goal-setting.html
6. training-plan.html
7. simulator.html
8. settings.html
9. activity-detail.html

## 更新手順

### 1. ナビゲーションHTMLを置き換え

各ファイルの `<nav class="flow-navbar">...</nav>` 部分を以下のHTMLに置き換えてください。
**注意**: `current` クラスを、そのページに対応するメニュー項目に設定してください。

```html
<nav class="flow-navbar">
    <div class="flow-nav-container">
        <div class="flow-nav-logo">AI Triathlon Coach</div>
        <div class="flow-nav-steps">
            <a href="home.html" class="flow-nav-step available">
                <span class="nav-icon">🏠</span>
                <span>ホーム</span>
            </a>
            <a href="index.html" class="flow-nav-step available">
                <span class="nav-icon">🤖</span>
                <span>AIコーチ</span>
            </a>
            <a href="news.html" class="flow-nav-step available">
                <span class="nav-icon">📰</span>
                <span>ニュース</span>
            </a>
            <a href="race-selection.html" class="flow-nav-step available">
                <span class="nav-icon">🎯</span>
                <span>レース選択</span>
            </a>
            <a href="goal-setting.html" class="flow-nav-step available">
                <span class="nav-icon">🏆</span>
                <span>目標設定</span>
            </a>
            <a href="training-plan.html" class="flow-nav-step available">
                <span class="nav-icon">📋</span>
                <span>計画</span>
            </a>
            <a href="simulator.html" class="flow-nav-step available">
                <span class="nav-icon">🔬</span>
                <span>シミュレーター</span>
            </a>
            <a href="data.html" class="flow-nav-step available">
                <span class="nav-icon">📊</span>
                <span>進捗</span>
            </a>
            <a href="settings.html" class="flow-nav-step available">
                <span class="nav-icon">⚙️</span>
                <span>設定</span>
            </a>
            <div class="nav-divider"></div>
            <a href="help.html" class="flow-nav-step available">
                <span class="nav-icon">❓</span>
                <span>ヘルプ</span>
            </a>
        </div>
    </div>
</nav>
```

### 2. CSSに以下を追加（nav-divider がない場合）

```css
/* ナビゲーション区切り線 */
.nav-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.2);
    margin: 12px 16px;
}
```

### 3. ツールチップ機能を追加する場合

#### 3-1. CSSに追加（</style>の前）

```css
/* ツールチップ対象要素 */
.has-tooltip {
    cursor: help;
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.has-tooltip::after {
    content: 'ⓘ';
    font-size: 0.75em;
    color: #9ca3af;
    transition: color 0.2s ease;
}

.has-tooltip:hover::after {
    color: #3b82f6;
}

/* ツールチップ本体 */
.metric-tooltip {
    position: fixed;
    z-index: 10000;
    max-width: 360px;
    padding: 16px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.1);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s ease, visibility 0.2s ease;
    pointer-events: none;
}

.metric-tooltip.visible {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
}

.metric-tooltip::before {
    content: '';
    position: absolute;
    width: 12px;
    height: 12px;
    background: white;
    transform: rotate(45deg);
    box-shadow: -2px -2px 5px rgba(0, 0, 0, 0.05);
}

.metric-tooltip.arrow-top::before {
    top: -6px;
    left: 50%;
    margin-left: -6px;
}

.metric-tooltip.arrow-bottom::before {
    bottom: -6px;
    left: 50%;
    margin-left: -6px;
}

.tooltip-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
}

.tooltip-icon { font-size: 1.5rem; }
.tooltip-title { font-size: 1rem; font-weight: 700; color: #1f2937; }
.tooltip-equivalent { font-size: 0.75rem; color: #6b7280; margin-top: 2px; }
.tooltip-body { font-size: 0.875rem; line-height: 1.6; color: #4b5563; }
.tooltip-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 12px;
    font-size: 0.8rem;
    color: #3b82f6;
    text-decoration: none;
    font-weight: 500;
}
.tooltip-link:hover { text-decoration: underline; }
```

#### 3-2. HTMLに追加（</body>の前）

```html
<!-- トレーニング指標ツールチップ -->
<script src="js/metrics-data.js"></script>
<script src="js/metrics-tooltip.js"></script>
```

#### 3-3. ツールチップを表示したい要素に属性を追加

```html
<!-- 例: トレーニング負荷にツールチップを追加 -->
<span class="has-tooltip" data-metric="trainingLoad">トレーニング負荷</span>

<!-- 例: フィットネスにツールチップを追加 -->
<span class="has-tooltip" data-metric="fitness">フィットネス</span>
```

#### 利用可能な data-metric 値

| data-metric値 | 表示される指標 |
|--------------|--------------|
| trainingLoad | トレーニング負荷 |
| normalizedPower | 正規化パワー |
| intensityFactor | 相対強度 |
| fitness | フィットネス |
| fatigue | 疲労 |
| condition | コンディション |
| ftp | FTP |
| css | CSS（スイム閾値） |
| thresholdPace | 閾値ペース |
| weeklyLoad | 週間負荷 |

---

## ファイル構成

更新後のファイル構成は以下のようになります：

```
/
├── css/
│   └── common.css          # 共通スタイル（将来的に統合用）
├── js/
│   ├── metrics-data.js     # 指標説明データ
│   └── metrics-tooltip.js  # ツールチップ機能
├── home.html
├── index.html
├── news.html
├── race-selection.html
├── goal-setting.html
├── training-plan.html
├── simulator.html
├── data.html               # 更新済み
├── settings.html
├── activity-detail.html
└── help.html               # 新規作成
```

---

## 用語変更一覧

| 旧表記（英語） | 新表記（日本語） |
|--------------|----------------|
| TSS | トレーニング負荷 |
| NP (Normalized Power) | 正規化パワー |
| IF (Intensity Factor) | 相対強度 |
| CTL (Chronic Training Load) | フィットネス |
| ATL (Acute Training Load) | 疲労 |
| TSB (Training Stress Balance) | コンディション |
| Fitness | フィットネス |
| Form | コンディション |
| Fatigue | 疲労 |
