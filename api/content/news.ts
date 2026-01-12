import type { VercelRequest, VercelResponse } from '@vercel/node'

const rssFeeds = [
  { name: 'Triathlete', url: 'https://www.triathlete.com/feed/' },
  { name: '220 Triathlon', url: 'https://www.220triathlon.com/feed/' },
  { name: 'LUMINA', url: 'https://lumina-magazine.com/feed/' },
  { name: 'DC Rainmaker', url: 'https://www.dcrainmaker.com/feed' },
  { name: 'TrainingPeaks', url: 'https://www.trainingpeaks.com/blog/feed/' }
]

const youtubeChannels = [
  { name: 'GTN', id: 'UC1x5Ij3jsw5Lj8S1TXcmLNw' },
  { name: 'World Triathlon', id: 'UCXRVKD6l-CYA7mQdMPg3KjA' },
  { name: 'IRONMAN', id: 'UCUlPrWg9EMR7CiMfK6GVwvQ' },
  { name: 'Triathlon LUMINA', id: 'UCUCCGRvP8Bf_vBNheT9tPvw' }
]

let feedCache: { data: any[] | null; timestamp: number | null } = { data: null, timestamp: null }
const CACHE_TTL = 60 * 60 * 1000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const forceRefresh = req.query.refresh === 'true'
    const now = Date.now()

    if (!forceRefresh && feedCache.data && feedCache.timestamp && (now - feedCache.timestamp < CACHE_TTL)) {
      return res.status(200).json({
        items: feedCache.data,
        cached: true,
        cacheAge: Math.round((now - feedCache.timestamp) / 1000)
      })
    }

    const allItems: any[] = []

    // Fetch YouTube feeds (simpler, more reliable)
    for (const channel of youtubeChannels) {
      try {
        const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`)
        if (response.ok) {
          const text = await response.text()
          const entries = text.match(/<entry>[\s\S]*?<\/entry>/g) || []
          entries.slice(0, 5).forEach((entry, i) => {
            const title = entry.match(/<title>(.*?)<\/title>/)?.[1] || ''
            const link = entry.match(/<link rel="alternate" href="(.*?)"/)?.[1] || ''
            const published = entry.match(/<published>(.*?)<\/published>/)?.[1] || ''
            allItems.push({
              id: `${channel.name}-${i}-${now}`,
              title,
              link,
              pubDate: published,
              source: channel.name,
              type: 'video'
            })
          })
        }
      } catch (e) {
        console.error(`Failed to fetch ${channel.name}:`, e)
      }
    }

    allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

    feedCache.data = allItems
    feedCache.timestamp = now

    return res.status(200).json({
      items: allItems,
      cached: false,
      totalItems: allItems.length
    })

  } catch (error) {
    console.error('Handler error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
