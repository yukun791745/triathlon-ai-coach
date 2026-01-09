// session-types.js
// セッションタイプの定義（UIとAPI両方で使用）

const SESSION_TYPES = {
    swim: [
        { id: 'swim_drill_focus', label: 'テクニック重視', description: 'ドリル中心、泳ぎ込みは少なめ' },
        { id: 'swim_drill_endurance', label: 'ドリル＋有酸素', description: 'ドリル後にZ2メインセット' },
        { id: 'swim_drill_speed', label: 'ドリル＋スピード', description: 'ドリル後に高強度インターバル' },
        { id: 'swim_endurance', label: '有酸素（泳ぎ込み）', description: 'ドリル少なめ、距離重視' },
        { id: 'swim_threshold', label: '閾値/CSSペース', description: 'CSS付近のテンポスイム' },
        { id: 'swim_interval', label: '高強度インターバル', description: 'スプリント、ディセンディング等' },
        { id: 'swim_ow', label: 'オープンウォーター', description: '海・湖での実践練習' },
        { id: 'swim_recovery', label: 'リカバリー', description: '軽く流す' },
        { id: 'swim_test', label: 'テスト/TT', description: 'CSS測定、タイム計測' }
    ],
    bike: [
        { id: 'bike_endurance', label: '有酸素エンデュランス', description: 'Z2中心、長時間' },
        { id: 'bike_tempo', label: 'テンポ/SST', description: 'FTP 88-94%付近' },
        { id: 'bike_threshold', label: '閾値/FTP走', description: 'FTP付近の持続走' },
        { id: 'bike_vo2max', label: 'VO2max/高強度', description: '3-8分の高強度インターバル' },
        { id: 'bike_technique_interval', label: 'テクニック＋インターバル', description: 'ケイデンスドリル後に高強度' },
        { id: 'bike_zwift_workout', label: 'Zwift構造化ワークアウト', description: 'Zwift等のプログラムメニュー' },
        { id: 'bike_hill', label: 'ヒルクライム', description: '登坂トレーニング' },
        { id: 'bike_brick', label: 'ブリック（→ラン）', description: 'バイク後すぐランへ移行' },
        { id: 'bike_recovery', label: 'リカバリー', description: '軽く回す' },
        { id: 'bike_test', label: 'テスト/TT', description: 'FTP測定、タイムトライアル' }
    ],
    run: [
        { id: 'run_easy', label: 'イージー/ジョグ', description: 'Z2、会話できるペース' },
        { id: 'run_long', label: 'ロング走', description: '長距離、後半ビルドアップ含む' },
        { id: 'run_tempo', label: 'テンポ/閾値走', description: 'LTペース、20-40分持続' },
        { id: 'run_interval', label: 'インターバル', description: '400m-1km等の反復' },
        { id: 'run_fartlek', label: 'ファルトレク', description: '不整地、自由なペース変化' },
        { id: 'run_hill', label: '坂道/ヒルトレーニング', description: '坂ダッシュ、登り走' },
        { id: 'run_brick', label: 'ブリック（バイク後）', description: 'バイク直後のラン' },
        { id: 'run_recovery', label: 'リカバリー', description: '非常に軽く' },
        { id: 'run_test', label: 'テスト/TT', description: 'タイムトライアル、閾値測定' }
    ],
    common: [
        { id: 'race', label: 'レース/大会', description: '本番レース' },
        { id: 'other', label: 'その他', description: '上記に当てはまらない' }
    ]
};

// セッションタイプごとの評価基準（AIコメント生成用）
const SESSION_EVALUATION = {
    // ===== スイム =====
    swim_drill_focus: {
        purpose: 'フォーム改善・技術習得',
        successMetrics: 'ストローク効率（DPS）、フォームの一貫性',
        evaluationPoints: [
            'DPSは向上または維持できているか',
            '心拍は低め（Z1-Z2）で技術に集中できたか',
            '距離より質を重視できたか'
        ],
        typicalIssues: [
            '後半でフォームが崩れてDPSが低下',
            '強度が上がりすぎて技術練習にならなかった'
        ]
    },
    swim_drill_endurance: {
        purpose: 'テクニック確認＋有酸素ベース構築',
        successMetrics: 'メインセットのペース安定性、心拍Z2維持',
        evaluationPoints: [
            'メインセットでZ2を維持できたか',
            'ペースは安定していたか',
            'ドリルで意識した動きをメインで実践できたか'
        ],
        typicalIssues: [
            'メインセットでオーバーペースになりZ3以上に',
            '後半でペースが大きく落ちた'
        ]
    },
    swim_drill_speed: {
        purpose: 'テクニック確認＋スピード向上',
        successMetrics: '高強度セットでのペース、レスト後の回復',
        evaluationPoints: [
            '高強度セットで目標ペースに到達できたか',
            'セット間でタイムを維持できたか',
            'フォームを保ちながらスピードを出せたか'
        ],
        typicalIssues: [
            '後半のセットでタイムが大幅に落ちた',
            'スピードを出そうとしてフォームが崩れた'
        ]
    },
    swim_endurance: {
        purpose: '有酸素能力向上・泳ぎ込み',
        successMetrics: 'ペース安定性、心拍ドリフト、総距離',
        evaluationPoints: [
            'Z2で安定して泳げたか',
            '心拍ドリフトは10%以内か',
            '後半までペースを維持できたか'
        ],
        typicalIssues: [
            '心拍ドリフトが大きい（脱水、オーバーペース）',
            '後半でペースが落ちた'
        ]
    },
    swim_threshold: {
        purpose: '乳酸処理能力向上',
        successMetrics: 'CSSペースの維持、心拍Z3-Z4',
        evaluationPoints: [
            'CSSペース±3秒/100m以内で泳げたか',
            'セット間でペースを維持できたか',
            '心拍はZ3-Z4で推移したか'
        ],
        typicalIssues: [
            'ペースが安定せずばらついた',
            '後半で大きくペースダウン'
        ]
    },
    swim_interval: {
        purpose: 'スピード向上・無酸素能力強化',
        successMetrics: '各本のタイム、レスト中の回復',
        evaluationPoints: [
            '設定タイムをクリアできたか',
            'セット間のタイム落ちは許容範囲内か',
            'レスト中に心拍は回復したか'
        ],
        typicalIssues: [
            '後半のセットで大幅にタイムが落ちた',
            'レストが足りず回復不十分'
        ]
    },
    swim_ow: {
        purpose: 'レース実践・オープンウォーター適応',
        successMetrics: 'ヘッドアップ頻度、直進性、波・流れへの対応',
        evaluationPoints: [
            'ヘッドアップしても大きくペースが落ちなかったか',
            '直進できたか（GPSトラックから）',
            '心理的に落ち着いて泳げたか'
        ],
        typicalIssues: [
            'プールより大幅にペースダウン',
            '蛇行して余計な距離を泳いだ'
        ]
    },
    swim_recovery: {
        purpose: '疲労回復・血流促進',
        successMetrics: '心拍Z1維持、主観的な楽さ',
        evaluationPoints: [
            'Z1で泳げたか',
            '主観的に楽だったか',
            '体の張りや疲労感は軽減したか'
        ],
        typicalIssues: [
            '強度が上がりすぎてリカバリーにならなかった'
        ]
    },
    swim_test: {
        purpose: '現状把握・CSS/閾値測定',
        successMetrics: 'オールアウトできたか、ペーシング',
        evaluationPoints: [
            '全力を出し切れたか',
            'ペース配分は適切だったか（前半突っ込みすぎ等）',
            '前回テストとの比較'
        ],
        typicalIssues: [
            '前半で突っ込みすぎて後半失速',
            '力を出し切れなかった'
        ]
    },

    // ===== バイク =====
    bike_endurance: {
        purpose: '有酸素ベース構築・脂肪燃焼効率向上',
        successMetrics: 'Z2維持、心拍ドリフト、ケイデンス安定',
        evaluationPoints: [
            'Z2（パワーまたは心拍）を維持できたか',
            '心拍ドリフトは10%以内か',
            'ケイデンスは安定していたか'
        ],
        typicalIssues: [
            '登りでZ3-Z4に上がりすぎた',
            '心拍ドリフトが大きい'
        ]
    },
    bike_tempo: {
        purpose: 'FTP向上・持久力強化',
        successMetrics: 'FTP88-94%維持、心拍Z3-Z4',
        evaluationPoints: [
            'スイートスポット（FTP88-94%）を維持できたか',
            '心拍はZ3-Z4で推移したか',
            '後半までパワーを維持できたか'
        ],
        typicalIssues: [
            '後半でパワーが落ちた',
            '強度が高すぎてFTP以上になった'
        ]
    },
    bike_threshold: {
        purpose: 'FTP向上・閾値耐性強化',
        successMetrics: 'FTP±3%維持、持続時間',
        evaluationPoints: [
            'FTPパワーを設定時間維持できたか',
            '心拍はZ4で安定したか',
            'ペダリングは最後まで滑らかだったか'
        ],
        typicalIssues: [
            '後半でパワーが維持できなかった',
            '心拍が上がりすぎてZ5に突入'
        ]
    },
    bike_vo2max: {
        purpose: 'VO2max向上・高強度耐性',
        successMetrics: '各セットのパワー維持、心拍Z5到達',
        evaluationPoints: [
            '各インターバルでFTP106-120%を出せたか',
            'セット間でパワーを維持できたか',
            '心拍はZ5に到達したか'
        ],
        typicalIssues: [
            '後半のセットでパワーが大幅低下',
            'レストが長すぎて強度が上がりきらなかった'
        ]
    },
    bike_technique_interval: {
        purpose: 'ペダリング技術向上＋高強度トレーニング',
        successMetrics: 'ケイデンスドリルの実行、インターバルのパワー',
        evaluationPoints: [
            'ハイ/ローケイデンスドリルを実行できたか',
            'ドリル後のインターバルでパワーを出せたか',
            'ペダリングの滑らかさは向上したか'
        ],
        typicalIssues: [
            'ドリルで疲労してインターバルの質が落ちた',
            'ケイデンスが安定しなかった'
        ]
    },
    bike_zwift_workout: {
        purpose: 'Zwiftメニューの完遂・計画的トレーニング',
        successMetrics: 'ワークアウト完遂率、各セグメントの達成度',
        evaluationPoints: [
            'ワークアウトを完遂できたか',
            '各セグメントの目標パワーを達成できたか',
            'ERGモードで意図した強度になっていたか'
        ],
        typicalIssues: [
            '途中でワークアウトを中断した',
            'ERGモードで実際のパワーが目標と乖離'
        ]
    },
    bike_hill: {
        purpose: '登坂力向上・パワーウェイトレシオ改善',
        successMetrics: '登りでのパワー維持、W/kg',
        evaluationPoints: [
            '登りで目標パワーを維持できたか',
            'シッティング/ダンシングを使い分けられたか',
            'W/kgは目標に近いか'
        ],
        typicalIssues: [
            '後半の登りでパワーが大幅低下',
            'ケイデンスが落ちすぎた'
        ]
    },
    bike_brick: {
        purpose: 'バイク→ラン移行適応',
        successMetrics: 'バイク後半のパワー維持、ラン移行のスムーズさ',
        evaluationPoints: [
            'バイク後半で脚を使いすぎていないか',
            'T2（トランジション）はスムーズだったか',
            'ランへの移行で脚が動いたか'
        ],
        typicalIssues: [
            'バイクで追い込みすぎてランが走れなかった',
            '移行直後に脚が重く動かなかった'
        ]
    },
    bike_recovery: {
        purpose: '疲労回復・アクティブレスト',
        successMetrics: 'Z1維持、低パワー、主観的な楽さ',
        evaluationPoints: [
            'Z1（心拍・パワーとも）で回せたか',
            '軽いギアで高ケイデンスを維持できたか',
            '主観的に楽だったか'
        ],
        typicalIssues: [
            '強度が上がりすぎた'
        ]
    },
    bike_test: {
        purpose: 'FTP測定・現状把握',
        successMetrics: 'オールアウト、ペーシング',
        evaluationPoints: [
            '全力を出し切れたか',
            'ペース配分は適切だったか',
            '前回テストとの比較'
        ],
        typicalIssues: [
            '前半で突っ込みすぎて後半失速',
            'メンタル的に追い込みきれなかった'
        ]
    },

    // ===== ラン =====
    run_easy: {
        purpose: '有酸素ベース構築・回復促進',
        successMetrics: 'Z2維持、会話ペース、心拍安定',
        evaluationPoints: [
            'Z2で走れたか',
            '会話できるペースだったか',
            '心拍ドリフトは小さいか'
        ],
        typicalIssues: [
            'ペースが上がりすぎてZ3に',
            '心拍ドリフトが大きい'
        ]
    },
    run_long: {
        purpose: '持久力向上・脂肪燃焼効率改善',
        successMetrics: 'Z2維持、後半のペース維持、心拍ドリフト',
        evaluationPoints: [
            '後半までZ2を維持できたか',
            'ネガティブスプリットまたはイーブンペースか',
            '心拍ドリフトは10%以内か'
        ],
        typicalIssues: [
            '後半で大きくペースダウン',
            '心拍ドリフトが大きい（脱水、オーバーペース）'
        ]
    },
    run_tempo: {
        purpose: '乳酸閾値向上・レースペース耐性',
        successMetrics: 'LTペース維持、心拍Z3-Z4安定',
        evaluationPoints: [
            '閾値ペースを維持できたか',
            '心拍はZ3-Z4で安定したか',
            'フォームは最後まで崩れなかったか'
        ],
        typicalIssues: [
            '後半でペースが維持できなかった',
            '強度が高すぎてZ5に突入'
        ]
    },
    run_interval: {
        purpose: 'VO2max向上・スピード強化',
        successMetrics: '各本のタイム、セット間の維持率',
        evaluationPoints: [
            '設定ペースをクリアできたか',
            'セット間でタイムを維持できたか',
            'レスト中に心拍は回復したか'
        ],
        typicalIssues: [
            '後半のセットでタイムが大幅低下',
            'レストが足りず回復不十分'
        ]
    },
    run_fartlek: {
        purpose: 'スピード変化への適応・レース実践',
        successMetrics: 'ペース変化の実行、主観的な強弱',
        evaluationPoints: [
            '意図したペース変化ができたか',
            '速い区間でしっかり上げられたか',
            '遅い区間で回復できたか'
        ],
        typicalIssues: [
            'ペース変化が曖昧になった',
            '全体的に強度が上がりすぎた'
        ]
    },
    run_hill: {
        purpose: '脚筋力強化・ランニングエコノミー向上',
        successMetrics: '登りでのフォーム維持、心拍回復',
        evaluationPoints: [
            '登りでフォームを維持できたか',
            '腕振り・膝上げを意識できたか',
            '下りでしっかり回復できたか'
        ],
        typicalIssues: [
            '登りでフォームが崩れた',
            '下りで回復できずオーバートレーニング'
        ]
    },
    run_brick: {
        purpose: 'バイク後のラン適応',
        successMetrics: '移行直後のペース、脚の動き',
        evaluationPoints: [
            '移行直後から脚が動いたか',
            '最初の1-2kmで目標ペースに乗れたか',
            'バイクの疲労を感じすぎなかったか'
        ],
        typicalIssues: [
            '最初の1kmで脚が全く動かなかった',
            'バイクで追い込みすぎてランが走れなかった'
        ]
    },
    run_recovery: {
        purpose: '疲労回復・血流促進',
        successMetrics: 'Z1維持、主観的な楽さ',
        evaluationPoints: [
            'Z1で走れたか',
            '「遅すぎる」と感じるくらいだったか',
            '体の張りは軽減したか'
        ],
        typicalIssues: [
            '強度が上がりすぎてリカバリーにならなかった'
        ]
    },
    run_test: {
        purpose: '閾値測定・現状把握',
        successMetrics: 'オールアウト、ペーシング',
        evaluationPoints: [
            '全力を出し切れたか',
            'ペース配分は適切だったか（ネガティブスプリットが理想）',
            '前回テストとの比較'
        ],
        typicalIssues: [
            '前半で突っ込みすぎて後半失速',
            'メンタル的に追い込みきれなかった'
        ]
    },

    // ===== 共通 =====
    race: {
        purpose: 'パフォーマンス発揮',
        successMetrics: '目標タイム達成、ペーシング戦略の実行',
        evaluationPoints: [
            '目標を達成できたか',
            'ペーシングは計画通りだったか',
            '補給・ギア選択は適切だったか',
            '次のレースへの学びは何か'
        ],
        typicalIssues: [
            '前半でオーバーペース',
            '補給が足りなかった/多すぎた',
            '想定外の状況への対応'
        ]
    },
    other: {
        purpose: 'ユーザー定義',
        successMetrics: 'ユーザーの補足に基づく',
        evaluationPoints: [
            '補足内容を参照して評価'
        ],
        typicalIssues: []
    }
};

// UIラベル
const UI_LABELS = {
    promptTitle: '🎯 今日のトレーニングの目的は？',
    promptSubtitle: '教えていただければ、AIコーチがより的確なコメントをお届けします',
    supplementLabel: '💬 補足（任意）',
    supplementPlaceholder: '例：後半ビルドアップを意識した、暑くてペースを抑えた、など',
    submitButton: 'AIコーチのコメントを見る',
    loadingText: 'AIコーチが分析中...',
    otherInputPlaceholder: '例：前半キック練習、後半プルブイで1500m'
};

// エクスポート（ブラウザ/Node.js両対応）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SESSION_TYPES, SESSION_EVALUATION, UI_LABELS };
}
