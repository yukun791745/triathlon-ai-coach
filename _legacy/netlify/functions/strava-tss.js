// netlify/functions/strava-tss.js
// TSS (Training Stress Score) 計算関数
// バイク用TSS、ラン用rTSS、スイム用sTSSを計算

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { 
            token, 
            activityId,
            // ユーザーの閾値設定
            thresholds = {}
        } = JSON.parse(event.body);

        if (!token || !activityId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'トークンとアクティビティIDが必要です' })
            };
        }

        // デフォルトの閾値設定
        const userThresholds = {
            // バイク FTP (Functional Threshold Power) - ワット
            ftp: thresholds.ftp || 200,
            
            // ラン rFTP (Running Functional Threshold Pace) - 秒/km
            // デフォルト: 5:00/km = 300秒/km
            rFtpPacePerKm: thresholds.rFtpPacePerKm || 300,
            
            // スイム sFTP (Swim Functional Threshold Pace) - 秒/100m
            // デフォルト: 1:40/100m = 100秒/100m
            sFtpPacePer100m: thresholds.sFtpPacePer100m || 100,
            
            // 最大心拍数（hrTSS計算用）
            maxHr: thresholds.maxHr || 190,
            
            // 閾値心拍数（hrTSS計算用）
            thresholdHr: thresholds.thresholdHr || 170
        };

        console.log('Calculating TSS for activity:', activityId);
        console.log('User thresholds:', userThresholds);

        // アクティビティ詳細を取得
        const detailResponse = await fetch(
            `https://www.strava.com/api/v3/activities/${activityId}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!detailResponse.ok) {
            throw new Error(`Activity fetch failed: ${detailResponse.status}`);
        }

        const activity = await detailResponse.json();
        const activityType = activity.sport_type || activity.type;

        // ストリームデータを取得
        const streamKeys = 'time,distance,velocity_smooth,watts,heartrate,altitude,grade_smooth';
        const streamResponse = await fetch(
            `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=${streamKeys}&key_type=time`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        let streams = {};
        if (streamResponse.ok) {
            const rawStreams = await streamResponse.json();
            if (Array.isArray(rawStreams)) {
                rawStreams.forEach(stream => {
                    streams[stream.type] = stream.data;
                });
            }
        }

        // アクティビティタイプに応じてTSSを計算
        let tssResult;
        
        if (['Ride', 'VirtualRide', 'EBikeRide', 'Handcycle', 'Velomobile'].includes(activityType)) {
            // バイク: パワーベースTSS
            tssResult = calculateBikeTSS(activity, streams, userThresholds);
        } else if (['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike'].includes(activityType)) {
            // ラン: rTSS
            tssResult = calculateRunTSS(activity, streams, userThresholds);
        } else if (['Swim'].includes(activityType)) {
            // スイム: sTSS
            tssResult = calculateSwimTSS(activity, streams, userThresholds);
        } else {
            // その他: 心拍ベースhrTSS
            tssResult = calculateHrTSS(activity, streams, userThresholds);
        }

        // 結果を返す
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                activityId: activityId,
                activityType: activityType,
                activityName: activity.name,
                date: activity.start_date_local,
                duration: {
                    moving_time: activity.moving_time,
                    elapsed_time: activity.elapsed_time,
                    formatted: formatDuration(activity.moving_time)
                },
                distance: {
                    meters: activity.distance,
                    km: (activity.distance / 1000).toFixed(2)
                },
                tss: tssResult,
                thresholdsUsed: userThresholds
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};


// ============================================
// バイク用 TSS 計算（パワーベース）
// ============================================
function calculateBikeTSS(activity, streams, thresholds) {
    const result = {
        type: 'TSS',
        sport: 'Bike',
        method: null,
        tss: null,
        details: {}
    };

    const movingTime = activity.moving_time; // 秒
    const durationHours = movingTime / 3600;
    const ftp = thresholds.ftp;

    // 方法1: ストリームからNormalized Powerを計算
    if (streams.watts && streams.watts.length > 0) {
        result.method = 'power_stream';
        
        const np = calculateNormalizedPower(streams.watts, streams.time);
        const avgPower = streams.watts.reduce((a, b) => a + b, 0) / streams.watts.length;
        const intensityFactor = np / ftp;
        const variabilityIndex = np / avgPower;
        
        // TSS = IF² × Duration(時間) × 100
        const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100);
        
        result.tss = tss;
        result.details = {
            normalizedPower: Math.round(np),
            averagePower: Math.round(avgPower),
            intensityFactor: intensityFactor.toFixed(2),
            variabilityIndex: variabilityIndex.toFixed(2),
            ftp: ftp,
            durationHours: durationHours.toFixed(2),
            formula: 'TSS = IF² × Duration(h) × 100',
            calculation: `TSS = ${intensityFactor.toFixed(2)}² × ${durationHours.toFixed(2)} × 100 = ${tss}`
        };
    }
    // 方法2: アクティビティの平均/加重平均パワーを使用
    else if (activity.weighted_average_watts || activity.average_watts) {
        result.method = 'activity_power';
        
        const np = activity.weighted_average_watts || activity.average_watts;
        const avgPower = activity.average_watts || np;
        const intensityFactor = np / ftp;
        
        const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100);
        
        result.tss = tss;
        result.details = {
            normalizedPower: Math.round(np),
            averagePower: Math.round(avgPower),
            intensityFactor: intensityFactor.toFixed(2),
            ftp: ftp,
            durationHours: durationHours.toFixed(2),
            formula: 'TSS = IF² × Duration(h) × 100',
            note: 'パワーストリームがないため、アクティビティの平均パワーを使用'
        };
    }
    // 方法3: パワーデータなし → 心拍ベースhrTSSにフォールバック
    else if (streams.heartrate || activity.average_heartrate) {
        result.method = 'heartrate_fallback';
        const hrResult = calculateHrTSS(activity, streams, thresholds);
        result.tss = hrResult.tss;
        result.details = hrResult.details;
        result.details.note = 'パワーデータがないため、心拍ベースで推定';
    }
    else {
        result.method = 'duration_estimate';
        // 非常に粗い推定: 1時間 = 50 TSS と仮定
        result.tss = Math.round(durationHours * 50);
        result.details = {
            note: 'パワー・心拍データがないため、時間から粗く推定（1時間=50TSS）',
            durationHours: durationHours.toFixed(2)
        };
    }

    return result;
}


// ============================================
// ラン用 rTSS 計算（ペースベース）
// ============================================
function calculateRunTSS(activity, streams, thresholds) {
    const result = {
        type: 'rTSS',
        sport: 'Run',
        method: null,
        tss: null,
        details: {}
    };

    const movingTime = activity.moving_time; // 秒
    const durationHours = movingTime / 3600;
    const distance = activity.distance; // メートル
    const rFtpPacePerKm = thresholds.rFtpPacePerKm; // 秒/km

    // 方法1: ストリームからNGP（Normalized Graded Pace）を計算
    if (streams.velocity_smooth && streams.velocity_smooth.length > 0) {
        result.method = 'pace_stream';
        
        // 勾配調整を適用（grade_smoothがあれば）
        let adjustedVelocities = [...streams.velocity_smooth];
        
        if (streams.grade_smooth && streams.grade_smooth.length === streams.velocity_smooth.length) {
            adjustedVelocities = streams.velocity_smooth.map((vel, i) => {
                const grade = streams.grade_smooth[i] || 0;
                // 勾配調整係数（1%上りにつき約3%の追加負荷）
                const gradeAdjustment = 1 + (grade * 0.03);
                return vel * gradeAdjustment;
            });
        }
        
        // NGP計算（速度ベース）
        const ngpVelocity = calculateNormalizedValue(adjustedVelocities, streams.time, 30);
        
        // 速度(m/s)をペース(秒/km)に変換
        const ngpPacePerKm = ngpVelocity > 0 ? 1000 / ngpVelocity : 0;
        
        // 平均ペース
        const avgVelocity = adjustedVelocities.filter(v => v > 0).reduce((a, b) => a + b, 0) / 
                           adjustedVelocities.filter(v => v > 0).length;
        const avgPacePerKm = avgVelocity > 0 ? 1000 / avgVelocity : 0;
        
        // IF = 閾値ペース / 実際のペース（速いほどIF高い）
        const intensityFactor = ngpPacePerKm > 0 ? rFtpPacePerKm / ngpPacePerKm : 0;
        
        // rTSS = IF² × Duration(時間) × 100
        const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100);
        
        result.tss = tss;
        result.details = {
            ngpPacePerKm: formatPace(ngpPacePerKm),
            avgPacePerKm: formatPace(avgPacePerKm),
            intensityFactor: intensityFactor.toFixed(2),
            rFtpPace: formatPace(rFtpPacePerKm),
            durationHours: durationHours.toFixed(2),
            hasGradeAdjustment: !!(streams.grade_smooth),
            formula: 'rTSS = IF² × Duration(h) × 100',
            calculation: `rTSS = ${intensityFactor.toFixed(2)}² × ${durationHours.toFixed(2)} × 100 = ${tss}`
        };
    }
    // 方法2: アクティビティの平均速度から計算
    else if (activity.average_speed && activity.average_speed > 0) {
        result.method = 'activity_pace';
        
        const avgVelocity = activity.average_speed; // m/s
        const avgPacePerKm = 1000 / avgVelocity; // 秒/km
        
        const intensityFactor = rFtpPacePerKm / avgPacePerKm;
        const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100);
        
        result.tss = tss;
        result.details = {
            avgPacePerKm: formatPace(avgPacePerKm),
            intensityFactor: intensityFactor.toFixed(2),
            rFtpPace: formatPace(rFtpPacePerKm),
            durationHours: durationHours.toFixed(2),
            formula: 'rTSS = IF² × Duration(h) × 100',
            note: 'ペースストリームがないため、平均ペースで計算（NGPなし）'
        };
    }
    // 方法3: 心拍ベースhrTSSにフォールバック
    else if (streams.heartrate || activity.average_heartrate) {
        result.method = 'heartrate_fallback';
        const hrResult = calculateHrTSS(activity, streams, thresholds);
        result.tss = hrResult.tss;
        result.details = hrResult.details;
        result.details.note = 'ペースデータがないため、心拍ベースで推定';
    }
    else {
        result.method = 'duration_estimate';
        result.tss = Math.round(durationHours * 60);
        result.details = {
            note: 'ペース・心拍データがないため、時間から粗く推定（1時間=60rTSS）',
            durationHours: durationHours.toFixed(2)
        };
    }

    return result;
}


// ============================================
// スイム用 sTSS 計算（ペースベース）
// ============================================
function calculateSwimTSS(activity, streams, thresholds) {
    const result = {
        type: 'sTSS',
        sport: 'Swim',
        method: null,
        tss: null,
        details: {}
    };

    const movingTime = activity.moving_time; // 秒
    const durationHours = movingTime / 3600;
    const distance = activity.distance; // メートル
    const sFtpPacePer100m = thresholds.sFtpPacePer100m; // 秒/100m

    // 方法1: ストリームから正規化ペースを計算
    if (streams.velocity_smooth && streams.velocity_smooth.length > 0) {
        result.method = 'pace_stream';
        
        // NP計算
        const npVelocity = calculateNormalizedValue(streams.velocity_smooth, streams.time, 30);
        
        // 速度(m/s)をペース(秒/100m)に変換
        const npPacePer100m = npVelocity > 0 ? 100 / npVelocity : 0;
        
        // 平均ペース
        const avgVelocity = streams.velocity_smooth.filter(v => v > 0).reduce((a, b) => a + b, 0) / 
                           streams.velocity_smooth.filter(v => v > 0).length;
        const avgPacePer100m = avgVelocity > 0 ? 100 / avgVelocity : 0;
        
        // IF = 閾値ペース / 実際のペース
        const intensityFactor = npPacePer100m > 0 ? sFtpPacePer100m / npPacePer100m : 0;
        
        // sTSS = IF² × Duration(時間) × 100
        const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100);
        
        result.tss = tss;
        result.details = {
            npPacePer100m: formatSwimPace(npPacePer100m),
            avgPacePer100m: formatSwimPace(avgPacePer100m),
            intensityFactor: intensityFactor.toFixed(2),
            sFtpPace: formatSwimPace(sFtpPacePer100m),
            durationHours: durationHours.toFixed(2),
            formula: 'sTSS = IF² × Duration(h) × 100',
            calculation: `sTSS = ${intensityFactor.toFixed(2)}² × ${durationHours.toFixed(2)} × 100 = ${tss}`
        };
    }
    // 方法2: 距離と時間から平均ペースを計算
    else if (distance > 0 && movingTime > 0) {
        result.method = 'activity_pace';
        
        const avgVelocity = distance / movingTime; // m/s
        const avgPacePer100m = 100 / avgVelocity; // 秒/100m
        
        const intensityFactor = sFtpPacePer100m / avgPacePer100m;
        const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100);
        
        result.tss = tss;
        result.details = {
            avgPacePer100m: formatSwimPace(avgPacePer100m),
            intensityFactor: intensityFactor.toFixed(2),
            sFtpPace: formatSwimPace(sFtpPacePer100m),
            durationHours: durationHours.toFixed(2),
            distanceMeters: distance,
            formula: 'sTSS = IF² × Duration(h) × 100',
            note: 'ペースストリームがないため、平均ペースで計算'
        };
    }
    // 方法3: 心拍ベースhrTSSにフォールバック
    else if (streams.heartrate || activity.average_heartrate) {
        result.method = 'heartrate_fallback';
        const hrResult = calculateHrTSS(activity, streams, thresholds);
        result.tss = hrResult.tss;
        result.details = hrResult.details;
        result.details.note = 'ペースデータがないため、心拍ベースで推定';
    }
    else {
        result.method = 'duration_estimate';
        result.tss = Math.round(durationHours * 50);
        result.details = {
            note: 'ペース・心拍データがないため、時間から粗く推定（1時間=50sTSS）',
            durationHours: durationHours.toFixed(2)
        };
    }

    return result;
}


// ============================================
// 心拍ベース hrTSS 計算
// ============================================
function calculateHrTSS(activity, streams, thresholds) {
    const result = {
        type: 'hrTSS',
        sport: 'Generic',
        method: null,
        tss: null,
        details: {}
    };

    const movingTime = activity.moving_time; // 秒
    const durationHours = movingTime / 3600;
    const maxHr = thresholds.maxHr;
    const thresholdHr = thresholds.thresholdHr;

    // 心拍データから計算
    if (streams.heartrate && streams.heartrate.length > 0) {
        result.method = 'hr_stream';
        
        // TRIMP (Training Impulse) ベースの計算
        const validHr = streams.heartrate.filter(hr => hr > 0);
        const avgHr = validHr.reduce((a, b) => a + b, 0) / validHr.length;
        
        // 心拍予備量（HRR）の割合
        const restingHr = Math.min(...validHr.filter(hr => hr > 40)); // 最小値を安静時と仮定
        const hrReserve = maxHr - restingHr;
        const avgHrr = (avgHr - restingHr) / hrReserve;
        
        // IF = 平均心拍 / 閾値心拍
        const intensityFactor = avgHr / thresholdHr;
        
        // hrTSS = IF² × Duration(時間) × 100
        // ただし心拍は変動が大きいので補正係数を適用
        const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100 * 0.9);
        
        result.tss = tss;
        result.details = {
            avgHeartrate: Math.round(avgHr),
            maxHeartrate: Math.max(...validHr),
            minHeartrate: Math.min(...validHr.filter(hr => hr > 40)),
            intensityFactor: intensityFactor.toFixed(2),
            hrReserveUsed: (avgHrr * 100).toFixed(1) + '%',
            thresholdHr: thresholdHr,
            maxHrSetting: maxHr,
            durationHours: durationHours.toFixed(2),
            formula: 'hrTSS = IF² × Duration(h) × 100 × 0.9',
            note: '心拍ベースの推定値（パワー/ペースより精度は低い）'
        };
    }
    // アクティビティの平均心拍から計算
    else if (activity.average_heartrate) {
        result.method = 'activity_hr';
        
        const avgHr = activity.average_heartrate;
        const intensityFactor = avgHr / thresholdHr;
        const tss = Math.round(Math.pow(intensityFactor, 2) * durationHours * 100 * 0.9);
        
        result.tss = tss;
        result.details = {
            avgHeartrate: Math.round(avgHr),
            maxHeartrate: activity.max_heartrate,
            intensityFactor: intensityFactor.toFixed(2),
            thresholdHr: thresholdHr,
            durationHours: durationHours.toFixed(2),
            formula: 'hrTSS = IF² × Duration(h) × 100 × 0.9',
            note: '平均心拍からの推定値'
        };
    }
    else {
        result.method = 'duration_estimate';
        result.tss = Math.round(durationHours * 50);
        result.details = {
            note: '心拍データがないため、時間から粗く推定（1時間=50hrTSS）',
            durationHours: durationHours.toFixed(2)
        };
    }

    return result;
}


// ============================================
// Normalized Power / Value 計算
// ============================================
function calculateNormalizedPower(powerData, timeData) {
    return calculateNormalizedValue(powerData, timeData, 30);
}

function calculateNormalizedValue(data, timeData, windowSeconds = 30) {
    if (!data || data.length === 0) return 0;
    
    // 有効なデータのみ
    const validData = data.filter(v => v > 0);
    if (validData.length === 0) return 0;
    
    // 時間データがない場合は1秒間隔と仮定
    const times = timeData || data.map((_, i) => i);
    
    // 30秒移動平均を計算
    const windowedData = [];
    let windowSum = 0;
    let windowCount = 0;
    let windowStartIdx = 0;
    
    for (let i = 0; i < data.length; i++) {
        windowSum += data[i];
        windowCount++;
        
        // ウィンドウの開始位置を調整
        while (windowStartIdx < i && (times[i] - times[windowStartIdx]) > windowSeconds) {
            windowSum -= data[windowStartIdx];
            windowCount--;
            windowStartIdx++;
        }
        
        if (windowCount > 0) {
            windowedData.push(windowSum / windowCount);
        }
    }
    
    if (windowedData.length === 0) return 0;
    
    // 4乗の平均の4乗根
    const fourthPowers = windowedData.map(v => Math.pow(v, 4));
    const avgFourthPower = fourthPowers.reduce((a, b) => a + b, 0) / fourthPowers.length;
    const normalizedValue = Math.pow(avgFourthPower, 0.25);
    
    return normalizedValue;
}


// ============================================
// ユーティリティ関数
// ============================================
function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatPace(secondsPerKm) {
    if (!secondsPerKm || secondsPerKm <= 0) return '-';
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.round(secondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}

function formatSwimPace(secondsPer100m) {
    if (!secondsPer100m || secondsPer100m <= 0) return '-';
    const minutes = Math.floor(secondsPer100m / 60);
    const seconds = Math.round(secondsPer100m % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/100m`;
}
