const https = require('https');

// ===== ユーティリティ =====
function fetchUrl(url, timeout = 20000) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ja,en;q=0.9',
                'Accept-Encoding': 'identity'
            }
        };
        const req = https.get(options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(timeout, () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

// ===== JTU スクレイピング (全11ページ) =====
async function fetchJTURaces() {
    const races = [];
    const seenIds = new Set();
    
    // 昇順で取得（古い→新しい）
    for (let page = 1; page <= 11; page++) {
        const url = page === 1
            ? 'https://www.jtu.or.jp/event/?filter=true&order=ASC'
            : `https://www.jtu.or.jp/event/page/${page}/?filter=true&order=ASC`;
        
        console.log(`JTU page ${page}: fetching...`);
        
        let html;
        try {
            html = await fetchUrl(url);
        } catch (e) {
            console.log(`JTU page ${page} error: ${e.message}`);
            continue;
        }
        
        // イベントブロックを抽出 (liタグ内のイベント)
        // パターン: <li class="...">...</li> 内に日付、タイトル、場所がある
        const eventPattern = /<li[^>]*>\s*(海外|国内)[^<]*<[^>]*>\s*(\d{4})\/(\d{1,2})\/(\d{1,2})[^<]*<[\s\S]*?<h4[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
        
        let match;
        while ((match = eventPattern.exec(html)) !== null) {
            const region = match[1];
            const year = match[2];
            const month = String(match[3]).padStart(2, '0');
            const day = String(match[4]).padStart(2, '0');
            const eventUrl = match[5].startsWith('http') ? match[5] : `https://www.jtu.or.jp${match[5]}`;
            const name = match[6].trim();
            
            const date = `${year}-${month}-${day}`;
            const id = `jtu_${date}_${name.substring(0, 20).replace(/[^a-zA-Z0-9\u3040-\u9fff]/g, '')}`;
            
            if (seenIds.has(id)) continue;
            seenIds.add(id);
            
            // 練習会、講習会、研修会をスキップ
            if (name.includes('練習会') || name.includes('講習会') || name.includes('研修会') || 
                name.includes('キャンプ') || name.includes('合宿') || name.includes('クリニック') ||
                name.includes('体験会') || name.includes('J-STAR') || name.includes('SCOPE')) {
                continue;
            }
            
            // 場所を抽出
            let location = region === '国内' ? '日本' : '海外';
            const locMatch = html.substring(match.index, match.index + 500).match(/([^\s<>]+[都道府県])\s*([^\s<>]*[市区町村郡])?/);
            if (locMatch) {
                location = (locMatch[1] + (locMatch[2] || '')).trim();
            }
            
            // 距離を判定
            let distance = 'スタンダード';
            const nl = name.toLowerCase();
            if (nl.includes('ロング') || nl.includes('long distance') || nl.includes('宮古島') || nl.includes('佐渡') || nl.includes('皆生') || nl.includes('五島')) distance = 'ロング';
            else if (nl.includes('ミドル') || nl.includes('middle') || nl.includes('70.3')) distance = 'ミドル';
            else if (nl.includes('スーパースプリント') || nl.includes('super sprint')) distance = 'スーパースプリント';
            else if (nl.includes('スプリント') || nl.includes('sprint')) distance = 'スプリント';
            else if (nl.includes('デュアスロン') || nl.includes('duathlon') || nl.includes('カーフマン')) distance = 'デュアスロン';
            else if (nl.includes('アクアスロン') || nl.includes('aquathlon')) distance = 'アクアスロン';
            else if (nl.includes('クロス') || nl.includes('cross') || nl.includes('xterra')) distance = 'オフロード';
            else if (nl.includes('t100')) distance = 'ミドル';
            
            // カテゴリを判定
            let category = 'JTU';
            if (name.includes('選手権') || name.includes('Championship')) category = 'JTU選手権';
            else if (name.includes('ワールドトライアスロン') || name.includes('World Triathlon')) {
                if (name.includes('シリーズ') || name.includes('Series')) category = 'WTS';
                else if (name.includes('カップ') || name.includes('Cup')) category = 'WT Cup';
                else if (name.includes('パラ') || name.includes('Para')) category = 'WT Para';
                else category = 'WT';
            }
            else if (name.includes('アジア') || name.includes('Asia')) category = 'アジア';
            else if (name.includes('T100')) category = 'T100';
            else if (name.includes('NCS') || name.includes('エイジ')) category = 'JTU/NCS';
            else if (name.includes('国民スポーツ') || name.includes('国体')) category = '国スポ';
            
            const country = region === '国内' ? '日本' : extractCountry(name, location);
            
            races.push({
                id, name, date, 
                loc: location,
                country,
                dist: distance,
                cat: category,
                source: 'JTU',
                url: eventUrl
            });
        }
        
        // 次のページがなければ終了
        if (!html.includes(`/event/page/${page + 1}/`)) {
            console.log(`JTU: No more pages after ${page}`);
            break;
        }
        
        // レート制限対策
        await new Promise(r => setTimeout(r, 300));
    }
    
    console.log(`JTU total: ${races.length} races`);
    return races;
}

function extractCountry(name, location) {
    const countryMap = {
        '中国': '中国', 'チャイナ': '中国', '成都': '中国', '北京': '中国', '上海': '中国',
        '韓国': '韓国', 'コリア': '韓国', '高城': '韓国', '群山': '韓国',
        '台湾': '台湾', '台東': '台湾',
        'フィリピン': 'フィリピン', 'ダバオ': 'フィリピン', 'スービック': 'フィリピン',
        'ベトナム': 'ベトナム', 'ダナン': 'ベトナム', 'ニャチャン': 'ベトナム',
        'タイ': 'タイ', 'プーケット': 'タイ',
        'マレーシア': 'マレーシア', 'ランカウイ': 'マレーシア',
        'シンガポール': 'シンガポール',
        'インドネシア': 'インドネシア', 'バリ': 'インドネシア',
        'オーストラリア': 'オーストラリア', 'ケアンズ': 'オーストラリア', 'ゴールドコースト': 'オーストラリア', 'バッセルトン': 'オーストラリア', 'ジーロング': 'オーストラリア', 'タスマニア': 'オーストラリア',
        'ニュージーランド': 'ニュージーランド', 'タウポ': 'ニュージーランド', 'ワナカ': 'ニュージーランド',
        'アメリカ': 'アメリカ', 'コナ': 'アメリカ', 'ハワイ': 'アメリカ', 'テキサス': 'アメリカ', 'カリフォルニア': 'アメリカ',
        'ドイツ': 'ドイツ', 'フランクフルト': 'ドイツ', 'ハンブルク': 'ドイツ', 'ロート': 'ドイツ',
        'フランス': 'フランス', 'ニース': 'フランス', 'ヴィシー': 'フランス',
        'スペイン': 'スペイン', 'バルセロナ': 'スペイン', 'ポンテベドラ': 'スペイン',
        'イタリア': 'イタリア', 'サルデーニャ': 'イタリア',
        'イギリス': 'イギリス', 'ロンドン': 'イギリス', 'テンビー': 'イギリス',
        'オランダ': 'オランダ', 'アルメーレ': 'オランダ',
        'スウェーデン': 'スウェーデン', 'カルマル': 'スウェーデン',
        'UAE': 'UAE', 'ドバイ': 'UAE', 'アブダビ': 'UAE',
        'カタール': 'カタール', 'ドーハ': 'カタール',
        'サウジアラビア': 'サウジアラビア', 'ジェッダ': 'サウジアラビア',
        'ヨルダン': 'ヨルダン', 'アカバ': 'ヨルダン',
        'セネガル': 'セネガル', 'ダカール': 'セネガル',
        'チリ': 'チリ', 'メキシコ': 'メキシコ', 'カナダ': 'カナダ',
        'スリランカ': 'スリランカ', 'コロンボ': 'スリランカ',
        '香港': '香港', 'ホンコン': '香港'
    };
    
    const text = name + ' ' + location;
    for (const [key, value] of Object.entries(countryMap)) {
        if (text.includes(key)) return value;
    }
    return '海外';
}

// ===== 静的データ（フォールバック用） =====
function getStaticRaces() {
    return [
        // JTU 国内主要大会
        {id:'s1',name:'石垣島トライアスロン大会',date:'2026-04-12',loc:'沖縄県石垣市',country:'日本',dist:'スタンダード',cat:'JTU/NCS',source:'Static',url:'https://www.jtu.or.jp/event/78271/'},
        {id:'s2',name:'全日本トライアスロン宮古島大会',date:'2026-04-19',loc:'沖縄県宮古島市',country:'日本',dist:'ロング',cat:'JTU主要',source:'Static',url:'https://tri-miyako.com/'},
        {id:'s3',name:'ワールドトライアスロンCS横浜',date:'2026-05-16',loc:'神奈川県横浜市',country:'日本',dist:'スタンダード',cat:'WTS',source:'Static',url:'https://www.jtu.or.jp/event/77637/'},
        {id:'s4',name:'アジアトライアスロンカップ大阪城',date:'2026-05-31',loc:'大阪府大阪市',country:'日本',dist:'スタンダード',cat:'アジア',source:'Static',url:'https://www.jtu.or.jp/event/79177/'},
        {id:'s5',name:'五島長崎国際トライアスロン',date:'2026-06-14',loc:'長崎県五島市',country:'日本',dist:'ロング',cat:'JTU/NCS',source:'Static',url:'https://www.jtu.or.jp/event/'},
        {id:'s6',name:'IRONMAN 70.3 セントレア知多半島',date:'2026-06-14',loc:'愛知県常滑市',country:'日本',dist:'ミドル',cat:'IRONMAN 70.3',source:'Static',url:'https://www.ironman.com/'},
        {id:'s7',name:'長良川国際トライアスロン',date:'2026-07-26',loc:'岐阜県海津市',country:'日本',dist:'スタンダード',cat:'JTU選手権',source:'Static',url:'https://www.jtu.or.jp/event/'},
        {id:'s8',name:'皆生トライアスロン',date:'2026-07-19',loc:'鳥取県米子市',country:'日本',dist:'ロング',cat:'JTU/NCS',source:'Static',url:'https://www.jtu.or.jp/event/'},
        {id:'s9',name:'珠洲トライアスロン',date:'2026-08-23',loc:'石川県珠洲市',country:'日本',dist:'ロング',cat:'JTU/NCS',source:'Static',url:'https://www.jtu.or.jp/event/'},
        {id:'s10',name:'佐渡国際トライアスロン大会',date:'2026-09-06',loc:'新潟県佐渡市',country:'日本',dist:'ロング',cat:'JTU選手権',source:'Static',url:'https://www.scsf.jp/'},
        {id:'s11',name:'IRONMAN Japan みなみ北海道',date:'2026-09-13',loc:'北海道北斗市',country:'日本',dist:'ロング',cat:'IRONMAN',source:'Static',url:'https://www.ironman.com/im-japan'},
        {id:'s12',name:'アジア競技大会トライアスロン',date:'2026-09-20',loc:'愛知県蒲郡市',country:'日本',dist:'スタンダード',cat:'アジア大会',source:'Static',url:'https://www.jtu.or.jp/event/79174/'},
        {id:'s13',name:'日本トライアスロン選手権 台場',date:'2026-11-01',loc:'東京都港区',country:'日本',dist:'スタンダード',cat:'JTU選手権',source:'Static',url:'https://www.jtu.or.jp/event/79210/'},
        {id:'s14',name:'ワールドトライアスロンカップ宮崎',date:'2026-11-15',loc:'宮崎県宮崎市',country:'日本',dist:'スタンダード',cat:'WT Cup',source:'Static',url:'https://www.jtu.or.jp/event/79186/'},
        // IRONMAN 海外
        {id:'s20',name:'IRONMAN 70.3 Davao',date:'2026-03-22',loc:'ダバオ',country:'フィリピン',dist:'ミドル',cat:'IRONMAN 70.3',source:'Static',url:'https://www.ironman.com/'},
        {id:'s21',name:'IRONMAN New Zealand',date:'2026-03-07',loc:'タウポ',country:'ニュージーランド',dist:'ロング',cat:'IRONMAN',source:'Static',url:'https://www.ironman.com/'},
        {id:'s22',name:'IRONMAN 70.3 Taiwan',date:'2026-04-12',loc:'台東',country:'台湾',dist:'ミドル',cat:'IRONMAN 70.3',source:'Static',url:'https://www.ironman.com/'},
        {id:'s23',name:'IRONMAN 70.3 Vietnam',date:'2026-05-10',loc:'ダナン',country:'ベトナム',dist:'ミドル',cat:'IRONMAN 70.3',source:'Static',url:'https://www.ironman.com/'},
        {id:'s24',name:'IRONMAN 70.3 Goseong',date:'2026-06-14',loc:'高城',country:'韓国',dist:'ミドル',cat:'IRONMAN 70.3',source:'Static',url:'https://www.ironman.com/'},
        {id:'s25',name:'IRONMAN Frankfurt',date:'2026-06-28',loc:'フランクフルト',country:'ドイツ',dist:'ロング',cat:'IRONMAN EU',source:'Static',url:'https://www.ironman.com/'},
        {id:'s26',name:'IRONMAN Nice',date:'2026-09-06',loc:'ニース',country:'フランス',dist:'ロング',cat:'IRONMAN WC',source:'Static',url:'https://www.ironman.com/'},
        {id:'s27',name:'IRONMAN World Championship',date:'2026-10-10',loc:'コナ',country:'アメリカ',dist:'ロング',cat:'IRONMAN WC',source:'Static',url:'https://www.ironman.com/'},
        {id:'s28',name:'IRONMAN 70.3 World Championship',date:'2026-09-20',loc:'タスマニア',country:'オーストラリア',dist:'ミドル',cat:'IRONMAN WC',source:'Static',url:'https://www.ironman.com/'},
        {id:'s29',name:'IRONMAN Western Australia',date:'2026-12-06',loc:'バッセルトン',country:'オーストラリア',dist:'ロング',cat:'IRONMAN AP',source:'Static',url:'https://www.ironman.com/'},
        // Challenge
        {id:'s30',name:'Challenge Taiwan',date:'2026-04-26',loc:'台東',country:'台湾',dist:'ロング',cat:'Challenge',source:'Static',url:'https://challengefamily.com/'},
        {id:'s31',name:'Challenge Roth',date:'2026-07-05',loc:'ロート',country:'ドイツ',dist:'ロング',cat:'Challenge',source:'Static',url:'https://challengefamily.com/'},
        {id:'s32',name:'Challenge Vietnam',date:'2026-08-02',loc:'ニャチャン',country:'ベトナム',dist:'ミドル',cat:'Challenge',source:'Static',url:'https://challengefamily.com/'},
        {id:'s33',name:'Challenge Gunsan',date:'2026-08-17',loc:'群山',country:'韓国',dist:'ミドル',cat:'Challenge',source:'Static',url:'https://challengefamily.com/'},
        {id:'s34',name:'Challenge Almere-Amsterdam',date:'2026-09-12',loc:'アルメーレ',country:'オランダ',dist:'ロング',cat:'Challenge',source:'Static',url:'https://challengefamily.com/'},
        // T100
        {id:'s40',name:'T100 Singapore',date:'2026-02-28',loc:'シンガポール',country:'シンガポール',dist:'ミドル',cat:'T100',source:'Static',url:'https://t100triathlon.com/'},
        {id:'s41',name:'T100 Gold Coast',date:'2026-03-21',loc:'ゴールドコースト',country:'オーストラリア',dist:'ミドル',cat:'T100',source:'Static',url:'https://t100triathlon.com/'},
        {id:'s42',name:'T100 San Francisco',date:'2026-05-30',loc:'サンフランシスコ',country:'アメリカ',dist:'ミドル',cat:'T100',source:'Static',url:'https://t100triathlon.com/'},
        {id:'s43',name:'T100 London',date:'2026-08-02',loc:'ロンドン',country:'イギリス',dist:'ミドル',cat:'T100',source:'Static',url:'https://t100triathlon.com/'},
        {id:'s44',name:'T100 Dubai',date:'2026-11-13',loc:'ドバイ',country:'UAE',dist:'ミドル',cat:'T100',source:'Static',url:'https://t100triathlon.com/'},
        // XTERRA
        {id:'s50',name:'XTERRA Japan',date:'2026-05-16',loc:'長野県',country:'日本',dist:'オフロード',cat:'XTERRA',source:'Static',url:'https://www.xterrajapan.com/'},
        {id:'s51',name:'XTERRA Asia-Pacific Championship',date:'2026-03-28',loc:'オーストラリア',country:'オーストラリア',dist:'オフロード',cat:'XTERRA',source:'Static',url:'https://www.xterraplanet.com/'},
        {id:'s52',name:'XTERRA World Championship',date:'2026-10-25',loc:'マウイ',country:'アメリカ',dist:'オフロード',cat:'XTERRA WC',source:'Static',url:'https://www.xterraplanet.com/'},
        // World Triathlon
        {id:'s60',name:'WTエイジグループ世界選手権ポンテベドラ',date:'2026-09-24',loc:'ポンテベドラ',country:'スペイン',dist:'スタンダード',cat:'WT World',source:'Static',url:'https://triathlon.org/'},
    ];
}

// ===== 重複除去 =====
function deduplicateRaces(races) {
    const seen = new Map();
    const normalize = (n) => n.toLowerCase()
        .replace(/第\d+回/g, '').replace(/\d{4}年?/g, '')
        .replace(/[（()）\s　]/g, '').replace(/トライアスロン/g, 'tri')
        .replace(/大会/g, '').trim();
    
    // JTU > Static > その他の優先度
    const priority = { 'JTU': 1, 'Static': 2 };
    
    for (const race of races) {
        const key = `${normalize(race.name)}_${race.date}`;
        const existing = seen.get(key);
        if (!existing || (priority[race.source] || 99) < (priority[existing.source] || 99)) {
            seen.set(key, race);
        }
    }
    return Array.from(seen.values());
}

// ===== メインハンドラー =====
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        console.log('Starting race fetch...');
        
        // JTUからスクレイピング
        let jtuRaces = [];
        let scrapingSuccess = false;
        
        try {
            jtuRaces = await fetchJTURaces();
            scrapingSuccess = jtuRaces.length > 20; // 20件以上取得できたら成功とみなす
            console.log(`JTU scraping: ${jtuRaces.length} races, success: ${scrapingSuccess}`);
        } catch (e) {
            console.error('JTU scraping failed:', e.message);
        }
        
        // 静的データを取得
        const staticRaces = getStaticRaces();
        
        // マージ（スクレイピング成功時はJTU優先、失敗時は静的データのみ）
        let allRaces = scrapingSuccess 
            ? [...jtuRaces, ...staticRaces]
            : staticRaces;
        
        // 重複除去
        const uniqueRaces = deduplicateRaces(allRaces);
        
        // 日付順にソート
        uniqueRaces.sort((a, b) => a.date.localeCompare(b.date));
        
        // 今日以降のレースのみ
        const today = new Date().toISOString().split('T')[0];
        const futureRaces = uniqueRaces.filter(r => r.date >= today);
        
        // 統計
        const japanCount = futureRaces.filter(r => r.country === '日本').length;
        const overseasCount = futureRaces.filter(r => r.country !== '日本').length;
        
        console.log(`Final: ${futureRaces.length} races (JP: ${japanCount}, Overseas: ${overseasCount})`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                scrapingSuccess,
                count: futureRaces.length,
                japanCount,
                overseasCount,
                lastUpdated: new Date().toISOString(),
                races: futureRaces
            })
        };
        
    } catch (error) {
        console.error('Handler error:', error);
        
        // エラー時は静的データを返す
        const staticRaces = getStaticRaces();
        const today = new Date().toISOString().split('T')[0];
        const futureRaces = staticRaces.filter(r => r.date >= today);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                scrapingSuccess: false,
                fallback: true,
                count: futureRaces.length,
                japanCount: futureRaces.filter(r => r.country === '日本').length,
                overseasCount: futureRaces.filter(r => r.country !== '日本').length,
                lastUpdated: new Date().toISOString(),
                races: futureRaces
            })
        };
    }
};
