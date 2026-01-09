/**
 * AI Triathlon Coach - トレーニング指標データ
 * ツールチップとヘルプページで共用
 */

window.METRICS_DATA = {
    // トレーニング負荷（TSS相当）
    trainingLoad: {
        name: 'トレーニング負荷',
        equivalent: 'TSS® (Training Stress Score)',
        shortDesc: 'ワークアウトの強度と時間を統合した総合的な負荷指標。閾値強度で1時間走ると100になります。',
        icon: '📊',
        color: '#8b5cf6'
    },

    // 正規化パワー（NP相当）
    normalizedPower: {
        name: '正規化パワー',
        equivalent: 'NP® (Normalized Power)',
        shortDesc: 'パワーの変動を考慮し、一定ペースで走った場合の等価パワーを推定。高強度区間の影響を適切に反映します。',
        icon: '⚡',
        color: '#f59e0b'
    },

    // 相対強度（IF相当）
    intensityFactor: {
        name: '相対強度',
        equivalent: 'IF® (Intensity Factor)',
        shortDesc: 'ワークアウトの強度をFTP（機能的閾値パワー）に対する割合で表示。1.0が閾値強度です。',
        icon: '🎯',
        color: '#ec4899'
    },

    // フィットネス（CTL相当）
    fitness: {
        name: 'フィットネス',
        equivalent: 'CTL® (Chronic Training Load)',
        shortDesc: '過去42日間のトレーニング負荷の加重平均。長期的な体力レベルを表し、時間をかけて徐々に向上します。',
        icon: '💪',
        color: '#3b82f6'
    },

    // 疲労レベル（ATL相当）
    fatigue: {
        name: '疲労',
        equivalent: 'ATL® (Acute Training Load)',
        shortDesc: '過去7日間のトレーニング負荷の加重平均。短期的な疲労の蓄積を表し、フィットネスより変動が大きいです。',
        icon: '😓',
        color: '#f59e0b'
    },

    // コンディション（TSB相当）
    condition: {
        name: 'コンディション',
        equivalent: 'TSB® (Training Stress Balance)',
        shortDesc: 'フィットネスから疲労を引いた値。パフォーマンスを発揮する準備状態を示し、レース前は+15〜+25が理想です。',
        icon: '🎭',
        color: '#10b981'
    },

    // FTP（機能的閾値パワー）
    ftp: {
        name: 'FTP',
        equivalent: 'Functional Threshold Power',
        shortDesc: '約1時間維持できる最大パワー。有酸素性と無酸素性代謝の境界点で、トレーニングゾーンの基準になります。',
        icon: '🔋',
        color: '#6366f1'
    },

    // CSS（Critical Swim Speed）
    css: {
        name: 'CSS',
        equivalent: 'Critical Swim Speed',
        shortDesc: '水泳の閾値ペース。約30分維持できる最速ペースで、スイムトレーニングのゾーン設定に使用します。',
        icon: '🏊',
        color: '#0ea5e9'
    },

    // 閾値ペース（ラン）
    thresholdPace: {
        name: '閾値ペース',
        equivalent: 'Threshold Pace / T-Pace',
        shortDesc: 'ランニングの閾値強度。約1時間維持できる最速ペースで、10kmレースペースとほぼ同等です。',
        icon: '🏃',
        color: '#22c55e'
    },

    // 週間負荷
    weeklyLoad: {
        name: '週間負荷',
        equivalent: 'Weekly TSS',
        shortDesc: '1週間のトレーニング負荷の合計。トレーニングボリュームの管理と計画に使用します。',
        icon: '📅',
        color: '#a855f7'
    }
};

// 読み込み確認用
console.log('METRICS_DATA loaded:', Object.keys(window.METRICS_DATA));
