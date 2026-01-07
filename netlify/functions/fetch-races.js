const https = require('https');

function fetchUrl(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ja,en;q=0.9'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const newUrl = res.headers.location.startsWith('http') ? res.headers.location : `https://www.jtu.or.jp${res.headers.location}`;
                fetchUrl(newUrl, timeout).then(resolve).catch(reject);
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

async function fetchJTURaces() {
    const races = [];
    try {
        for (let page = 1; page <= 8; page++) {
            const url = page === 1 
                ? 'https://www.jtu.or.jp/event/?filter=true&order=ASC&prefecture=%E5%9B%BD%E5%86%85'
                : `https://www.jtu.or.jp/event/page/${page}/?filter=true&order=ASC&prefecture=%E5%9B%BD%E5%86%85`;
            
            let html;
            try { html = await fetchUrl(url); } catch (e) { break; }
            
            const eventMatches = html.matchAll(/<article[^>]*class="[^"]*event-item[^"]*"[^>]*>([\s\S]*?)<\/article>/gi);
            for (const match of eventMatches) {
                const block = match[1];
                const dateMatch = block.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
                if (!dateMatch) continue;
                const date = `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, '0')}-${String(dateMatch[3]).padStart(2, '0')}`;
                const titleMatch = block.match(/<h[34][^>]*>([\s\S]*?)<\/h[34]>/i);
                let name = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                if (!name || name.length < 3) continue;
                const urlMatch = block.match(/href="(https?:\/\/www\.jtu\.or\.jp\/event\/\d+\/)"/);
                const eventUrl = urlMatch ? urlMatch[1] : 'https://www.jtu.or.jp/event/';
                const locationMatch = block.match(/([^\s<>]+[都道府県])\s*([^\s<>]*[市区町村郡])?/);
                const location = locationMatch ? (locationMatch[1] + (locationMatch[2] || '')).trim() : '日本';
                let distance = 'スタンダード';
                const nl = name.toLowerCase();
                if (nl.includes('ロング') || nl.includes('long')) distance = 'ロング';
                else if (nl.includes('ミドル') || nl.includes('70.3')) distance = 'ミドル';
                else if (nl.includes('スプリント')) distance = 'スプリント';
                let category = 'JTU公認';
                if (name.includes('選手権')) category = 'JTU選手権';
                else if (name.includes('ワールド') || name.includes('World')) category = 'WTS';
                races.push({ id: `jtu_${date}_${races.length}`, name, date, location, country: '日本', distance, category, source: 'JTU', url: eventUrl });
            }
            if (!html.includes(`/event/page/${page + 1}/`)) break;
            await new Promise(r => setTimeout(r, 200));
        }
    } catch (e) { console.error('JTU error:', e.message); }
    return races;
}

async function fetchLuminaRaces() {
    const races = [];
    try {
        const html = await fetchUrl('https://lumina-magazine.com/archives/news/20760');
        const matches = html.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日[^<]*(?:<[^>]*>)*\s*([^<]*(?:トライアスロン|アイアンマン)[^<]*)/gi);
        for (const m of matches) {
            const date = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
            const name = m[4].trim();
            if (name && name.length > 3) {
                let distance = 'スタンダード';
                if (name.includes('ロング')) distance = 'ロング';
                else if (name.includes('ミドル') || name.includes('70.3')) distance = 'ミドル';
                races.push({ id: `lumina_${date}_${races.length}`, name, date, location: '日本', country: '日本', distance, category: 'LUMINA', source: 'LUMINA', url: 'https://lumina-magazine.com/race-guide' });
            }
        }
    } catch (e) { console.error('LUMINA error:', e.message); }
    return races;
}

function getStaticRaces() {
    return [
        { name: 'IRONMAN Japan みなみ北海道', date: '2026-09-13', location: '北海道函館市', country: '日本', distance: 'ロング', category: 'IRONMAN', source: 'IRONMAN', url: 'https://www.ironman.com/im-japan' },
        { name: 'IRONMAN 70.3 セントレア知多半島', date: '2026-06-14', location: '愛知県常滑市', country: '日本', distance: 'ミドル', category: 'IRONMAN 70.3', source: 'IRONMAN', url: 'https://www.ironman.com/' },
        { name: 'IRONMAN 70.3 Taiwan', date: '2026-04-12', location: '台東', country: '台湾', distance: 'ミドル', category: 'IRONMAN 70.3', source: 'IRONMAN', url: 'https://www.ironman.com/' },
        { name: 'IRONMAN 70.3 Davao', date: '2026-03-22', location: 'ダバオ', country: 'フィリピン', distance: 'ミドル', category: 'IRONMAN 70.3', source: 'IRONMAN', url: 'https://www.ironman.com/' },
        { name: 'IRONMAN 70.3 Goseong', date: '2026-06-14', location: '高城', country: '韓国', distance: 'ミドル', category: 'IRONMAN 70.3', source: 'IRONMAN', url: 'https://www.ironman.com/' },
        { name: 'IRONMAN World Championship', date: '2026-10-10', location: 'コナ', country: 'アメリカ', distance: 'ロング', category: 'IRONMAN WC', source: 'IRONMAN', url: 'https://www.ironman.com/' },
        { name: 'Challenge Taiwan', date: '2026-04-26', location: '台東', country: '台湾', distance: 'ロング', category: 'Challenge', source: 'Challenge', url: 'https://challengefamily.com/' },
        { name: 'Challenge Roth', date: '2026-07-05', location: 'ロート', country: 'ドイツ', distance: 'ロング', category: 'Challenge', source: 'Challenge', url: 'https://challengefamily.com/' },
        { name: 'Challenge Gunsan', date: '2026-08-17', location: '群山', country: '韓国', distance: 'ミドル', category: 'Challenge', source: 'Challenge', url: 'https://challengefamily.com/' },
        { name: 'T100 Singapore', date: '2026-02-28', location: 'シンガポール', country: 'シンガポール', distance: 'T100', category: 'T100', source: 'T100', url: 'https://t100triathlon.com/' },
        { name: 'T100 Dubai', date: '2026-11-13', location: 'ドバイ', country: 'UAE', distance: 'T100', category: 'T100', source: 'T100', url: 'https://t100triathlon.com/' },
        { name: 'XTERRA Japan', date: '2026-05-16', location: '長野県', country: '日本', distance: 'オフロード', category: 'XTERRA', source: 'XTERRA', url: 'https://www.xterrajapan.com/' },
    ].map((r, i) => ({ ...r, id: `${r.source.toLowerCase()}_${r.date}_${i}` }));
}

function deduplicateRaces(races) {
    const seen = new Map();
    const priority = { 'JTU': 1, 'LUMINA': 2, 'IRONMAN': 3, 'Challenge': 4, 'T100': 5, 'XTERRA': 6 };
    function normalize(n) { return n.toLowerCase().replace(/第\d+回/g, '').replace(/\d{4}年?/g, '').replace(/[（()）\s]/g, '').replace(/トライアスロン/g, 'tri'); }
    for (const race of races) {
        const key = `${normalize(race.name)}_${race.date}`;
        if (!seen.has(key) || (priority[race.source] || 99) < (priority[seen.get(key).source] || 99)) {
            seen.set(key, race);
        }
    }
    return Array.from(seen.values());
}

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    
    try {
        const [jtuRaces, luminaRaces] = await Promise.allSettled([fetchJTURaces(), fetchLuminaRaces()]);
        let allRaces = [...getStaticRaces()];
        if (jtuRaces.status === 'fulfilled') allRaces = allRaces.concat(jtuRaces.value);
        if (luminaRaces.status === 'fulfilled') allRaces = allRaces.concat(luminaRaces.value);
        
        const uniqueRaces = deduplicateRaces(allRaces);
        uniqueRaces.sort((a, b) => a.date.localeCompare(b.date));
        const today = new Date().toISOString().split('T')[0];
        const futureRaces = uniqueRaces.filter(r => r.date >= today);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                count: futureRaces.length,
                japanCount: futureRaces.filter(r => r.country === '日本').length,
                overseasCount: futureRaces.filter(r => r.country !== '日本').length,
                lastUpdated: new Date().toISOString(),
                races: futureRaces
            })
        };
    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
