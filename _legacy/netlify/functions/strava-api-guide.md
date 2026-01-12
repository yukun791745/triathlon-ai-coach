# Strava API 拡張関数ガイド

## 📁 作成したファイル

以下の4つのNetlify Functionを作成しました。`netlify/functions/` ディレクトリに配置してください。

| ファイル | 機能 |
|---------|------|
| `strava-streams.js` | 時系列データ（心拍、ペース、標高、GPS等） |
| `strava-laps.js` | ラップデータ |
| `strava-zones.js` | 心拍ゾーン・パワーゾーン |
| `strava-activity-full.js` | 上記全てを一括取得 |

---

## 📊 取得可能なデータ一覧

### 1. strava-streams.js（時系列データ）

```javascript
// リクエスト
POST /.netlify/functions/strava-streams
{
    "token": "アクセストークン",
    "activityId": 12345678
}

// レスポンス
{
    "success": true,
    "streams": {
        "time": { "data": [0, 1, 2, ...] },           // 経過時間（秒）
        "distance": { "data": [0, 5.2, 10.8, ...] },  // 累積距離（m）
        "heartrate": { "data": [120, 125, 130, ...] }, // 心拍（bpm）
        "altitude": { "data": [100, 102, 105, ...] },  // 標高（m）
        "velocity_smooth": { "data": [3.5, 3.6, ...] }, // 速度（m/s）
        "cadence": { "data": [180, 182, ...] },        // ケイデンス
        "watts": { "data": [200, 210, ...] },          // パワー（W）
        "latlng": { "data": [[35.6, 139.7], ...] },    // GPS座標
        "grade_smooth": { "data": [0, 1.5, ...] },     // 勾配（%）
        "temp": { "data": [20, 21, ...] }              // 気温（℃）
    },
    "stats": {
        "heartrate": { "min": 100, "max": 180, "avg": 145 },
        "altitude": { "min": 50, "max": 200, "gain": 150, "loss": 120 },
        "velocity": { "avg_pace_per_km": 5.5 }
    }
}
```

### 2. strava-laps.js（ラップデータ）

```javascript
// リクエスト
POST /.netlify/functions/strava-laps
{
    "token": "アクセストークン",
    "activityId": 12345678
}

// レスポンス
{
    "success": true,
    "laps": [
        {
            "lap_index": 1,
            "distance_km": "1.00",
            "moving_time_formatted": "5:30",
            "pace_formatted": "5:30/km",
            "average_heartrate": 145,
            "max_heartrate": 160,
            "total_elevation_gain": 10
        },
        // ...
    ],
    "analysis": {
        "pace": {
            "fastest": "5:00/km",
            "slowest": "6:00/km",
            "average": "5:30/km",
            "fastestLapIndex": 3,
            "slowestLapIndex": 1
        },
        "splitAnalysis": {
            "firstHalfAvgPace": "5:40/km",
            "secondHalfAvgPace": "5:20/km",
            "isNegativeSplit": true  // 後半が速い
        }
    }
}
```

### 3. strava-zones.js（心拍ゾーン）

```javascript
// リクエスト
POST /.netlify/functions/strava-zones
{
    "token": "アクセストークン",
    "activityId": 12345678
}

// レスポンス
{
    "success": true,
    "heartrateZones": {
        "zones": [
            { "zone": 1, "name": "リカバリー", "time_formatted": "5:00", "percentage": "10.0" },
            { "zone": 2, "name": "有酸素ベース", "time_formatted": "15:00", "percentage": "30.0" },
            { "zone": 3, "name": "テンポ", "time_formatted": "20:00", "percentage": "40.0" },
            { "zone": 4, "name": "閾値", "time_formatted": "8:00", "percentage": "16.0" },
            { "zone": 5, "name": "最大", "time_formatted": "2:00", "percentage": "4.0" }
        ],
        "analysis": {
            "dominantZone": { "zone": 3, "percentage": "40.0" },
            "trainingType": "テンポ/閾値トレーニング"
        }
    }
}
```

### 4. strava-activity-full.js（一括取得）

```javascript
// リクエスト
POST /.netlify/functions/strava-activity-full
{
    "token": "アクセストークン",
    "activityId": 12345678,
    "include": {
        "detail": true,
        "streams": true,
        "laps": true,
        "zones": true
    }
}

// レスポンス - 上記全てのデータを含む
{
    "success": true,
    "detail": { ... },
    "streams": { ... },
    "laps": { ... },
    "zones": { ... },
    "summary": {
        "hasGPS": true,
        "hasHeartrate": true,
        "hasPower": false,
        "dataQualityScore": 85
    }
}
```

---

## 🗺️ 地図表示用データ

GPSデータは `streams.latlng` に含まれます：

```javascript
// 例: Leaflet.js で地図表示
const latlngs = streams.latlng.data;  // [[35.6, 139.7], [35.61, 139.71], ...]
const polyline = L.polyline(latlngs, { color: 'red' }).addTo(map);
map.fitBounds(polyline.getBounds());
```

---

## 📈 グラフ表示用データ

時系列グラフには `streams` のデータを使用：

```javascript
// 例: Chart.js で心拍グラフ
const labels = streams.time.data.map(t => Math.floor(t / 60) + '分');
const data = streams.heartrate.data;

new Chart(ctx, {
    type: 'line',
    data: {
        labels: labels,
        datasets: [{
            label: '心拍数',
            data: data
        }]
    }
});
```

---

## ⚠️ 注意事項

1. **インドアアクティビティ**: GPSデータなし
2. **心拍計なし**: 心拍・ゾーンデータなし
3. **パワーメーターなし**: パワーデータなし
4. **APIレート制限**: 15分あたり100リクエスト、1日あたり1000リクエスト

---

## 🔧 フロントエンドでの呼び出し例

```javascript
async function fetchActivityFullData(activityId) {
    const token = getAccessToken(); // 保存されたトークンを取得
    
    const response = await fetch('/.netlify/functions/strava-activity-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token: token,
            activityId: activityId
        })
    });
    
    const data = await response.json();
    
    if (data.success) {
        // 地図表示
        if (data.streams?.data?.latlng) {
            displayMap(data.streams.data.latlng);
        }
        
        // 心拍グラフ
        if (data.streams?.data?.heartrate) {
            displayHeartRateChart(data.streams.data.time, data.streams.data.heartrate);
        }
        
        // ラップ表示
        if (data.laps?.laps) {
            displayLapsTable(data.laps.laps);
        }
        
        // ゾーン表示
        if (data.zones?.heartrateZones) {
            displayZonesChart(data.zones.heartrateZones.zones);
        }
    }
}
```
