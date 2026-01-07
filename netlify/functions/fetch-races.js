const https = require('https');
const http = require('http');

// ===== ユーティリティ関数 =====
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ja,en;q=0.9'
            }
        }, (res) => {
            // リダイレクト対応
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchUrl(res.headers.location).then(resolve).catch(reject);
                return;
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

// HTMLからテキストを抽出
function extractText(html, startMarker, endMarker) {
    const startIdx = html.indexOf(startMarker);
    if (startIdx === -1) return '';
    const endIdx = html.indexOf(endMarker, startIdx + startMarker.length);
    if (endIdx === -1) return '';
    return html.substring(startIdx + startMarker.length, endIdx);
}

// 日付をパース
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // 様々な形式に対応
    const patterns = [
        /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,  // 2025-04-13, 2025/4/13
        /(\d{4})年(\d{1,2})月(\d{1,2})日/,       // 2025年4月13日
        /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,  // 04-13-2025
    ];
    
    for (const pattern of patterns) {
        const match = dateStr.match(pattern);
        if (match) {
            let year, month, day;
            if (pattern.source.startsWith('(\\d{4})')) {
                [, year, month, day] = match;
            } else {
                [, month, day, year] = match;
            }
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }
    return null;
}

// ===== JTU データ取得 =====
async function fetchJTURaces() {
    const races = [];
    
    try {
        // JTUイベントページを取得（複数ページ）
        for (let page = 1; page <= 5; page++) {
            const url = page === 1 
                ? 'https://www.jtu.or.jp/event/?filter=true&order=ASC'
                : `https://www.jtu.or.jp/event/page/${page}/?filter=true&order=ASC`;
            
            console.log(`Fetching JTU page ${page}: ${url}`);
            
            const html = await fetchUrl(url);
            
            // イベントカードを抽出
            const eventPattern = /<a[^>]*href="(https:\/\/www\.jtu\.or\.jp\/event\/\d+\/)"[^>]*>[\s\S]*?<\/a>/gi;
            const datePattern = /(\d{4})\/(\d{1,2})\/(\d{1,2})/;
            const titlePattern = /<h4[^>]*>([\s\S]*?)<\/h4>/i;
            
            // シンプルなパターンマッチング
            const eventBlocks = html.split('<li class="event-item');
            
            for (const block of eventBlocks) {
                if (!block.includes('jtu.or.jp/event/')) continue;
                
                // 日付抽出
                const dateMatch = block.match(datePattern);
                if (!dateMatch) continue;
                
                const date = `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, '0')}-${String(dateMatch[3]).padStart(2, '0')}`;
                
                // タイトル抽出
                const titleMatch = block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i) || 
                                   block.match(/class="event-title[^"]*"[^>]*>([\s\S]*?)</i);
                let name = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                
                if (!name) continue;
                
                // URL抽出
                const urlMatch = block.match(/href="(https:\/\/www\.jtu\.or\.jp\/event\/\d+\/)"/);
                const eventUrl = urlMatch ? urlMatch[1] : 'https://www.jtu.or.jp/event/';
                
                // 場所抽出
                const locationMatch = block.match(/([^\s<>]+[都道府県])/);
                const location = locationMatch ? locationMatch[1] : '日本';
                
                // 距離タイプ判定
                let distance = 'スタンダード';
                const nameLower = name.toLowerCase();
                if (nameLower.includes('ロング') || nameLower.includes('long')) distance = 'ロング';
                else if (nameLower.includes('ミドル') || nameLower.includes('middle') || nameLower.includes('70.3')) distance = 'ミドル';
                else if (nameLower.includes('スプリント') || nameLower.includes('sprint')) distance = 'スプリント';
                else if (nameLower.includes('スーパースプリント')) distance = 'スーパースプリント';
                
                // カテゴリ判定
                let category = 'JTU公認大会';
                if (name.includes('選手権')) category = 'JTU選手権';
                else if (name.includes('ワールド') || name.includes('World')) category = 'JTU国際大会';
                else if (name.includes('アジア') || name.includes('Asia')) category = 'JTU国際大会';
                
                // 海外/国内判定
                const isOverseas = block.includes('海外') || !block.includes('国内');
                
                races.push({
                    id: `jtu_${date}_${races.length}`,
                    name: name,
                    date: date,
                    location: location,
                    country: isOverseas ? '海外' : '日本',
                    distance: distance,
                    category: category,
                    source: 'JTU',
                    url: eventUrl,
                    description: `${category} - ${location}`,
                    features: [category, distance]
                });
            }
            
            // 次のページがなければ終了
            if (!html.includes(`/event/page/${page + 1}/`)) break;
        }
        
        console.log(`JTU: ${races.length} races found`);
    } catch (error) {
        console.error('JTU fetch error:', error.message);
    }
    
    return races;
}

// ===== LUMINA データ取得 =====
async function fetchLuminaRaces() {
    const races = [];
    
    try {
        const url = 'https://lumina-magazine.com/race-guide';
        console.log(`Fetching LUMINA: ${url}`);
        
        const html = await fetchUrl(url);
        
        // テーブル行を抽出
        const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        const rows = html.match(rowPattern) || [];
        
        for (const row of rows) {
            // 日付
            const dateMatch = row.match(/(\d{4})年(\d{2})月(\d{2})日/);
            if (!dateMatch) continue;
            
            const date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
            
            // 場所
            const prefectureMatch = row.match(/([^\s<>]+[都道府県県])/);
            const location = prefectureMatch ? prefectureMatch[1] : '日本';
            
            // 大会名
            const nameMatch = row.match(/<td[^>]*>([^<]+トライアスロン[^<]*)<\/td>/i) ||
                              row.match(/<td[^>]*>([^<]*大会[^<]*)<\/td>/i);
            let name = nameMatch ? nameMatch[1].trim() : '';
            
            if (!name || name.length < 5) continue;
            
            // 距離判定
            let distance = 'スタンダード';
            const nameLower = name.toLowerCase();
            if (nameLower.includes('ロング') || nameLower.includes('アイアンマン')) distance = 'ロング';
            else if (nameLower.includes('ミドル') || nameLower.includes('70.3')) distance = 'ミドル';
            else if (nameLower.includes('スプリント')) distance = 'スプリント';
            
            races.push({
                id: `lumina_${date}_${races.length}`,
                name: name,
                date: date,
                location: location,
                country: '日本',
                distance: distance,
                category: 'LUMINA大会',
                source: 'LUMINA',
                url: 'https://lumina-magazine.com/race-guide',
                description: `LUMINA掲載 - ${location}`,
                features: ['LUMINA', distance]
            });
        }
        
        console.log(`LUMINA: ${races.length} races found`);
    } catch (error) {
        console.error('LUMINA fetch error:', error.message);
    }
    
    return races;
}

// ===== IRONMAN データ（静的データ + API） =====
async function fetchIronmanRaces() {
    // IRONMANはAPIが複雑なため、主要な日本・アジア大会を静的に定義
    // 実際の運用では公式APIを使用することを推奨
    const races = [
        {
            id: 'ironman_japan_2025',
            name: 'IRONMAN Japan South Hokkaido',
            date: '2025-09-14',
            location: '北海道',
            country: '日本',
            distance: 'ロング',
            category: 'IRONMAN',
            source: 'IRONMAN',
            url: 'https://www.ironman.com/im-japan',
            description: '日本唯一のフルアイアンマン大会',
            features: ['IRONMAN', 'ロング', '北海道']
        },
        {
            id: 'ironman703_japan_2025',
            name: 'IRONMAN 70.3 Nagoya Japan',
            date: '2025-11-02',
            location: '愛知県名古屋市',
            country: '日本',
            distance: 'ミドル',
            category: 'IRONMAN 70.3',
            source: 'IRONMAN',
            url: 'https://www.ironman.com/im703-japan',
            description: 'IRONMAN 70.3 日本大会',
            features: ['IRONMAN 70.3', 'ミドル', '名古屋']
        },
        {
            id: 'ironman703_davao_2026',
            name: 'IRONMAN 70.3 Davao Philippines',
            date: '2026-03-22',
            location: 'Davao',
            country: 'フィリピン',
            distance: 'ミドル',
            category: 'IRONMAN 70.3',
            source: 'IRONMAN',
            url: 'https://www.ironman.com/im703-davao',
            description: 'フィリピン・ダバオで開催',
            features: ['IRONMAN 70.3', 'ミドル', 'アジア']
        },
        {
            id: 'ironman703_taiwan_2026',
            name: 'IRONMAN 70.3 Taiwan',
            date: '2026-04-12',
            location: 'Taitung',
            country: '台湾',
            distance: 'ミドル',
            category: 'IRONMAN 70.3',
            source: 'IRONMAN',
            url: 'https://www.ironman.com/im703-taiwan',
            description: '台湾・台東で開催',
            features: ['IRONMAN 70.3', 'ミドル', 'アジア']
        },
        {
            id: 'ironman703_goseong_2026',
            name: 'IRONMAN 70.3 Goseong Korea',
            date: '2026-06-14',
            location: 'Goseong',
            country: '韓国',
            distance: 'ミドル',
            category: 'IRONMAN 70.3',
            source: 'IRONMAN',
            url: 'https://www.ironman.com/im703-goseong',
            description: '韓国・高城で開催',
            features: ['IRONMAN 70.3', 'ミドル', 'アジア']
        },
        {
            id: 'ironman_wc_kona_2026',
            name: 'IRONMAN World Championship Kona',
            date: '2026-10-10',
            location: 'Kailua-Kona, Hawaii',
            country: 'アメリカ',
            distance: 'ロング',
            category: 'IRONMAN World Championship',
            source: 'IRONMAN',
            url: 'https://www.ironman.com/im-world-championship',
            description: 'トライアスロンの最高峰、コナ世界選手権',
            features: ['World Championship', 'ロング', 'Kona']
        }
    ];
    
    console.log(`IRONMAN: ${races.length} races (static data)`);
    return races;
}

// ===== Challenge Family データ =====
async function fetchChallengeRaces() {
    const races = [
        {
            id: 'challenge_taiwan_2026',
            name: 'Challenge Taiwan',
            date: '2026-04-26',
            location: 'Taitung',
            country: '台湾',
            distance: 'ロング',
            category: 'Challenge Family',
            source: 'Challenge',
            url: 'https://challengefamily.com/race/challenge-taiwan/',
            description: 'アジア最大級のロングディスタンス大会',
            features: ['Challenge Family', 'ロング', 'アジア']
        },
        {
            id: 'challenge_gunsan_2026',
            name: 'Challenge Gunsan-Saemangeum',
            date: '2026-08-17',
            location: 'Gunsan',
            country: '韓国',
            distance: 'ミドル',
            category: 'Challenge Family',
            source: 'Challenge',
            url: 'https://challengefamily.com/race/challenge-gunsan/',
            description: '世界最長の防波堤コースを走る',
            features: ['Challenge Family', 'ミドル', 'アジア']
        },
        {
            id: 'challenge_roth_2026',
            name: 'DATEV Challenge Roth',
            date: '2026-07-05',
            location: 'Roth',
            country: 'ドイツ',
            distance: 'ロング',
            category: 'Challenge Family',
            source: 'Challenge',
            url: 'https://challengefamily.com/race/challenge-roth/',
            description: '世界最大のロングディスタンス大会',
            features: ['Challenge Family', 'ロング', 'ヨーロッパ', 'Roth']
        }
    ];
    
    console.log(`Challenge: ${races.length} races (static data)`);
    return races;
}

// ===== T100 データ =====
async function fetchT100Races() {
    const races = [
        {
            id: 't100_singapore_2026',
            name: 'T100 Singapore',
            date: '2026-02-28',
            location: 'Singapore',
            country: 'シンガポール',
            distance: 'T100',
            category: 'T100 World Tour',
            source: 'T100',
            url: 'https://t100triathlon.com/',
            description: 'PTO T100ワールドツアー シンガポール大会',
            features: ['T100', 'プロ', 'アジア']
        },
        {
            id: 't100_gold_coast_2026',
            name: 'T100 Gold Coast',
            date: '2026-03-21',
            location: 'Gold Coast',
            country: 'オーストラリア',
            distance: 'T100',
            category: 'T100 World Tour',
            source: 'T100',
            url: 'https://t100triathlon.com/',
            description: 'PTO T100ワールドツアー ゴールドコースト大会',
            features: ['T100', 'プロ', 'オセアニア']
        },
        {
            id: 't100_dubai_2026',
            name: 'T100 Dubai',
            date: '2026-11-12',
            location: 'Dubai',
            country: 'UAE',
            distance: 'T100',
            category: 'T100 World Tour',
            source: 'T100',
            url: 'https://t100triathlon.com/',
            description: 'PTO T100ワールドツアー ドバイ大会',
            features: ['T100', 'プロ', '中東']
        }
    ];
    
    console.log(`T100: ${races.length} races (static data)`);
    return races;
}

// ===== XTERRA データ =====
async function fetchXterraRaces() {
    const races = [
        {
            id: 'xterra_japan_2026',
            name: 'XTERRA Japan Nenouekogen',
            date: '2026-05-16',
            location: '長野県根羽村',
            country: '日本',
            distance: 'オフロード',
            category: 'XTERRA',
            source: 'XTERRA',
            url: 'https://www.xterrajapan.com/',
            description: 'XTERRA日本大会 - オフロードトライアスロン',
            features: ['XTERRA', 'オフロード', 'MTB']
        },
        {
            id: 'xterra_apac_2026',
            name: 'XTERRA Asia Pacific Championship',
            date: '2026-03-28',
            location: 'Australia',
            country: 'オーストラリア',
            distance: 'オフロード',
            category: 'XTERRA Championship',
            source: 'XTERRA',
            url: 'https://www.xterraplanet.com/',
            description: 'XTERRAアジア太平洋選手権',
            features: ['XTERRA', 'Championship', 'オフロード']
        }
    ];
    
    console.log(`XTERRA: ${races.length} races (static data)`);
    return races;
}

// ===== メインハンドラー =====
exports.handler = async (event, context) => {
    // CORS ヘッダー
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        const params = event.queryStringParameters || {};
        const sources = params.sources ? params.sources.split(',') : ['all'];
        const forceRefresh = params.refresh === 'true';
        
        console.log(`Fetching races from sources: ${sources.join(', ')}`);
        
        let allRaces = [];
        
        // 各ソースからデータ取得
        const fetchPromises = [];
        
        if (sources.includes('all') || sources.includes('jtu')) {
            fetchPromises.push(fetchJTURaces());
        }
        if (sources.includes('all') || sources.includes('lumina')) {
            fetchPromises.push(fetchLuminaRaces());
        }
        if (sources.includes('all') || sources.includes('ironman')) {
            fetchPromises.push(fetchIronmanRaces());
        }
        if (sources.includes('all') || sources.includes('challenge')) {
            fetchPromises.push(fetchChallengeRaces());
        }
        if (sources.includes('all') || sources.includes('t100')) {
            fetchPromises.push(fetchT100Races());
        }
        if (sources.includes('all') || sources.includes('xterra')) {
            fetchPromises.push(fetchXterraRaces());
        }
        
        const results = await Promise.allSettled(fetchPromises);
        
        for (const result of results) {
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                allRaces = allRaces.concat(result.value);
            }
        }
        
        // 重複除去（同じ日付・名前のレース）
        const uniqueRaces = [];
        const seen = new Set();
        
        for (const race of allRaces) {
            const key = `${race.date}_${race.name.substring(0, 20)}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueRaces.push(race);
            }
        }
        
        // 日付順にソート
        uniqueRaces.sort((a, b) => a.date.localeCompare(b.date));
        
        // 今日以降のレースのみフィルタ
        const today = new Date().toISOString().split('T')[0];
        const futureRaces = uniqueRaces.filter(race => race.date >= today);
        
        console.log(`Total: ${futureRaces.length} future races`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                count: futureRaces.length,
                lastUpdated: new Date().toISOString(),
                races: futureRaces
            })
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};
