const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 10000, // タイムアウトを10秒に延長
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; TriathlonAICoach/1.0)'
  }
});

// RSSフィード設定（拡張版）
const rssFeeds = [
  // 既存のソース
  { name: 'Triathlete', url: 'https://www.triathlete.com/feed/' },
  { name: 'Slowtwitch', url: 'https://www.slowtwitch.com/feed/' },
  { name: '220 Triathlon', url: 'https://www.220triathlon.com/feed/' },
  { name: 'LUMINA', url: 'https://lumina-magazine.com/feed/' },
  
  // 新規追加ソース
  { name: 'DC Rainmaker', url: 'https://www.dcrainmaker.com/feed' },
  { name: 'World Triathlon', url: 'https://www.triathlon.org/rss' },
  { name: 'TrainingPeaks', url: 'https://www.trainingpeaks.com/blog/feed/' },
  { name: 'Ironman', url: 'https://www.ironman.com/news-rss' },
  { name: 'Triathlon Magazine Canada', url: 'https://triathlonmagazine.ca/feed/' }
];

// YouTubeチャンネル設定
const youtubeChannels = [
  // 海外チャンネル
  { name: 'GTN', id: 'UC1x5Ij3jsw5Lj8S1TXcmLNw' },
  { name: 'World Triathlon', id: 'UCXRVKD6l-CYA7mQdMPg3KjA' },
  { name: 'IRONMAN', id: 'UCUlPrWg9EMR7CiMfK6GVwvQ' },
  { name: 'T100 Triathlon', id: 'UCITB6kXrkXZBD9e_sHCVE1Q' },
  { name: 'DC Rainmaker', id: 'UCd-eE2v3gQJTgCRGmZL2uFQ' },
  
  // 日本語チャンネル
  { name: 'Triathlon LUMINA', id: 'UCUCCGRvP8Bf_vBNheT9tPvw' },
  { name: 'JTU', id: 'UCVDeZm3hyrZQMn0G19iQzDQ' },
  { name: 'Lapulem', id: 'UCo71o37Z18nDo-qb1y5xKnA' },
  { name: 'ヒロ/トライアスロン', id: 'UCYuqo2-kFmcTHBl7G3dgyvw' },
  { name: '古谷純平', id: 'UCi8LOra2y2wkwv2GHRQEz0A' }
];

// Podcastフィード設定
const podcastFeeds = [
  { name: 'TriDot Podcast', url: 'https://feeds.captivate.fm/the-tridot-triathlon-podcast/' }
];

// キャッシュ設定
let feedCache = {
  data: null,
  timestamp: null,
  ttl: 60 * 60 * 1000 // 1時間
};

// 翻訳キャッシュ
const translationCache = new Map();

// RSSフィードを取得
async function fetchRSSFeed(feed) {
  try {
    const data = await parser.parseURL(feed.url);
    return data.items.slice(0, 10).map(item => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate || item.isoDate,
      source: feed.name,
      type: 'article',
      summary: item.contentSnippet?.substring(0, 200) || item.summary?.substring(0, 200) || ''
    }));
  } catch (error) {
    console.error(`Error fetching ${feed.name}:`, error.message);
    return [];
  }
}

// YouTubeフィードを取得
async function fetchYouTubeFeed(channel) {
  try {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
    const data = await parser.parseURL(url);
    return data.items.slice(0, 5).map(item => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate || item.isoDate,
      source: channel.name,
      type: 'video',
      thumbnail: item['media:group']?.['media:thumbnail']?.[0]?.['$']?.url || null,
      summary: item['media:group']?.['media:description']?.[0] || ''
    }));
  } catch (error) {
    console.error(`Error fetching YouTube ${channel.name}:`, error.message);
    return [];
  }
}

// Podcastフィードを取得
async function fetchPodcastFeed(feed) {
  try {
    const data = await parser.parseURL(feed.url);
    return data.items.slice(0, 5).map(item => ({
      title: item.title,
      link: item.link || item.enclosure?.url,
      pubDate: item.pubDate || item.isoDate,
      source: feed.name,
      type: 'podcast',
      thumbnail: item.itunes?.image || data.image?.url || null,
      summary: item.contentSnippet?.substring(0, 200) || item.itunes?.summary?.substring(0, 200) || ''
    }));
  } catch (error) {
    console.error(`Error fetching podcast ${feed.name}:`, error.message);
    return [];
  }
}

// テキストを翻訳
async function translateText(text, apiKey) {
  if (!text || !apiKey) return text;
  
  // キャッシュをチェック
  if (translationCache.has(text)) {
    return translationCache.get(text);
  }
  
  // 日本語が含まれている場合は翻訳しない
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
    return text;
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'あなたは翻訳者です。与えられた英語のテキストを自然な日本語に翻訳してください。翻訳のみを返してください。'
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }
    
    const data = await response.json();
    const translatedText = data.choices[0]?.message?.content?.trim() || text;
    
    // キャッシュに保存
    translationCache.set(text, translatedText);
    
    return translatedText;
  } catch (error) {
    console.error('Translation error:', error.message);
    return text;
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  
  // OPTIONSリクエストの処理
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    const params = event.queryStringParameters || {};
    const forceRefresh = params.refresh === 'true';
    const translateFlag = params.translate === 'true';
    const openaiApiKey = params.apiKey || null;
    const itemId = params.id || null;
    
    // 単一アイテムの翻訳リクエスト
    if (itemId && translateFlag && openaiApiKey) {
      const title = params.title || '';
      const translatedTitle = await translateText(title, openaiApiKey);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: itemId,
          translatedTitle,
          translated: translatedTitle !== title
        })
      };
    }
    
    // キャッシュが有効な場合はキャッシュを返す
    const now = Date.now();
    if (!forceRefresh && feedCache.data && feedCache.timestamp && (now - feedCache.timestamp < feedCache.ttl)) {
      console.log('Returning cached data');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          items: feedCache.data,
          cached: true,
          cacheAge: Math.round((now - feedCache.timestamp) / 1000)
        })
      };
    }
    
    console.log('Fetching fresh data from all sources...');
    
    // 並列でフィードを取得（エラーハンドリング強化）
    const [rssResults, youtubeResults, podcastResults] = await Promise.all([
      Promise.all(rssFeeds.map(feed => 
        fetchRSSFeed(feed).catch(err => {
          console.error(`Failed to fetch RSS ${feed.name}:`, err);
          return [];
        })
      )),
      Promise.all(youtubeChannels.map(channel => 
        fetchYouTubeFeed(channel).catch(err => {
          console.error(`Failed to fetch YouTube ${channel.name}:`, err);
          return [];
        })
      )),
      Promise.all(podcastFeeds.map(feed => 
        fetchPodcastFeed(feed).catch(err => {
          console.error(`Failed to fetch Podcast ${feed.name}:`, err);
          return [];
        })
      ))
    ]);
    
    // 結果を結合
    const allItems = [
      ...rssResults.flat(),
      ...youtubeResults.flat(),
      ...podcastResults.flat()
    ];
    
    console.log(`Total items fetched: ${allItems.length}`);
    
    // 日付でソート（新しい順）
    allItems.sort((a, b) => {
      const dateA = new Date(a.pubDate || 0);
      const dateB = new Date(b.pubDate || 0);
      return dateB - dateA;
    });
    
    // 一意のIDを付与
    const itemsWithId = allItems.map((item, index) => ({
      ...item,
      id: `${item.source.replace(/\s+/g, '-')}-${index}-${Date.now()}`
    }));
    
    // キャッシュを更新
    feedCache.data = itemsWithId;
    feedCache.timestamp = now;
    
    console.log('Feed cache updated successfully');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        items: itemsWithId,
        cached: false,
        totalItems: itemsWithId.length,
        sources: {
          rss: rssFeeds.length,
          youtube: youtubeChannels.length,
          podcasts: podcastFeeds.length
        }
      })
    };
    
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};
