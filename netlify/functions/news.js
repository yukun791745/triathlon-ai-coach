const Parser = require('rss-parser');

// RSSパーサーの初期化
const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TriathlonAICoach/1.0)'
    }
});

// フィードソースの定義
// TODO: ユーザーが指定したフィードに置き換え
const FEED_SOURCES = {
    // ニュースフィード
    news: [
        {
            url: 'https://www.triathlete.com/feed/',
            name: 'Triathlete.com',
            language: 'en'
        },
        // 他のフィードは後で追加
    ],
    // YouTubeチャンネル
    youtube: [
        {
            // GTN (Global Triathlon Network)
            url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC1WLbdXhDmMxhJ9eJyPHp7g',
            name: 'GTN',
            language: 'en'
        },
        // 他のチャンネルは後で追加
    ],
    // マイチャンネル（最上位表示）
    myChannel: {
        url: '', // ユーザーのチャンネルURLを設定
        name: 'マイチャンネル',
        language: 'ja'
    }
};

// 日付を「〜前」形式に変換
function timeAgo(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
        return `${diffMins}分前`;
    } else if (diffHours < 24) {
        return `${diffHours}時間前`;
    } else if (diffDays < 7) {
        return `${diffDays}日前`;
    } else {
        return new Date(date).toLocaleDateString('ja-JP');
    }
}

// YouTubeサムネイルURLを取得
function getYouTubeThumbnail(videoId) {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

// YouTube動画IDを抽出
function extractYouTubeVideoId(link) {
    const match = link.match(/watch\?v=([^&]+)/) || link.match(/\/([^\/]+)$/);
    return match ? match[1] : null;
}

// 単一フィードを取得
async function fetchSingleFeed(source, type) {
    try {
        const feed = await parser.parseURL(source.url);
        
        return feed.items.slice(0, 10).map(item => {
            const isYouTube = source.url.includes('youtube.com');
            const videoId = isYouTube ? extractYouTubeVideoId(item.link) : null;
            
            return {
                type: isYouTube ? 'video' : 'news',
                title: item.title,
                source: source.name,
                language: source.language,
                time: timeAgo(item.pubDate || item.isoDate),
                timestamp: new Date(item.pubDate || item.isoDate).getTime(),
                url: item.link,
                summary: item.contentSnippet ? item.contentSnippet.substring(0, 150) + '...' : '',
                thumbnail: isYouTube && videoId ? getYouTubeThumbnail(videoId) : null
            };
        });
    } catch (error) {
        console.error(`Error fetching ${source.name}:`, error.message);
        return [];
    }
}

// メインハンドラー
exports.handler = async (event, context) => {
    // CORS対応
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // OPTIONSリクエスト対応
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // クエリパラメータ
        const params = event.queryStringParameters || {};
        const feedType = params.type || 'all'; // all, news, videos, myChannel

        let allItems = [];

        // マイチャンネル
        if ((feedType === 'all' || feedType === 'myChannel') && FEED_SOURCES.myChannel.url) {
            const myChannelItems = await fetchSingleFeed(FEED_SOURCES.myChannel, 'myChannel');
            allItems.push(...myChannelItems.map(item => ({ ...item, isMyChannel: true })));
        }

        // YouTubeフィード
        if (feedType === 'all' || feedType === 'videos') {
            for (const source of FEED_SOURCES.youtube) {
                const items = await fetchSingleFeed(source, 'video');
                allItems.push(...items);
            }
        }

        // ニュースフィード
        if (feedType === 'all' || feedType === 'news') {
            for (const source of FEED_SOURCES.news) {
                const items = await fetchSingleFeed(source, 'news');
                allItems.push(...items);
            }
        }

        // 日付順にソート（新しい順）
        allItems.sort((a, b) => b.timestamp - a.timestamp);

        // マイチャンネルを最上位に
        const myChannelItems = allItems.filter(item => item.isMyChannel);
        const otherItems = allItems.filter(item => !item.isMyChannel);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                myChannel: myChannelItems,
                items: otherItems,
                totalCount: allItems.length,
                fetchedAt: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Handler error:', error);
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
