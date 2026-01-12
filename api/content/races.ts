import type { VercelRequest, VercelResponse } from '@vercel/node'

function getStaticRaces() {
  return [
    {id:'s1',name:'石垣島トライアスロン大会',date:'2026-04-12',loc:'沖縄県石垣市',country:'日本',dist:'スタンダード',cat:'JTU/NCS',source:'Static'},
    {id:'s2',name:'全日本トライアスロン宮古島大会',date:'2026-04-19',loc:'沖縄県宮古島市',country:'日本',dist:'ロング',cat:'JTU主要',source:'Static'},
    {id:'s3',name:'ワールドトライアスロンCS横浜',date:'2026-05-16',loc:'神奈川県横浜市',country:'日本',dist:'スタンダード',cat:'WTS',source:'Static'},
    {id:'s4',name:'アジアトライアスロンカップ大阪城',date:'2026-05-31',loc:'大阪府大阪市',country:'日本',dist:'スタンダード',cat:'アジア',source:'Static'},
    {id:'s5',name:'五島長崎国際トライアスロン',date:'2026-06-14',loc:'長崎県五島市',country:'日本',dist:'ロング',cat:'JTU/NCS',source:'Static'},
    {id:'s6',name:'IRONMAN 70.3 セントレア知多半島',date:'2026-06-14',loc:'愛知県常滑市',country:'日本',dist:'ミドル',cat:'IRONMAN 70.3',source:'Static'},
    {id:'s7',name:'長良川国際トライアスロン',date:'2026-07-26',loc:'岐阜県海津市',country:'日本',dist:'スタンダード',cat:'JTU選手権',source:'Static'},
    {id:'s8',name:'皆生トライアスロン',date:'2026-07-19',loc:'鳥取県米子市',country:'日本',dist:'ロング',cat:'JTU/NCS',source:'Static'},
    {id:'s9',name:'珠洲トライアスロン',date:'2026-08-23',loc:'石川県珠洲市',country:'日本',dist:'ロング',cat:'JTU/NCS',source:'Static'},
    {id:'s10',name:'佐渡国際トライアスロン大会',date:'2026-09-06',loc:'新潟県佐渡市',country:'日本',dist:'ロング',cat:'JTU選手権',source:'Static'},
    {id:'s11',name:'IRONMAN Japan みなみ北海道',date:'2026-09-13',loc:'北海道北斗市',country:'日本',dist:'ロング',cat:'IRONMAN',source:'Static'},
    {id:'s12',name:'アジア競技大会トライアスロン',date:'2026-09-20',loc:'愛知県蒲郡市',country:'日本',dist:'スタンダード',cat:'アジア大会',source:'Static'},
    {id:'s13',name:'日本トライアスロン選手権 台場',date:'2026-11-01',loc:'東京都港区',country:'日本',dist:'スタンダード',cat:'JTU選手権',source:'Static'},
    {id:'s20',name:'IRONMAN 70.3 Davao',date:'2026-03-22',loc:'ダバオ',country:'フィリピン',dist:'ミドル',cat:'IRONMAN 70.3',source:'Static'},
    {id:'s21',name:'IRONMAN New Zealand',date:'2026-03-07',loc:'タウポ',country:'ニュージーランド',dist:'ロング',cat:'IRONMAN',source:'Static'},
    {id:'s22',name:'IRONMAN 70.3 Taiwan',date:'2026-04-12',loc:'台東',country:'台湾',dist:'ミドル',cat:'IRONMAN 70.3',source:'Static'},
    {id:'s23',name:'IRONMAN 70.3 Vietnam',date:'2026-05-10',loc:'ダナン',country:'ベトナム',dist:'ミドル',cat:'IRONMAN 70.3',source:'Static'},
    {id:'s25',name:'IRONMAN Frankfurt',date:'2026-06-28',loc:'フランクフルト',country:'ドイツ',dist:'ロング',cat:'IRONMAN EU',source:'Static'},
    {id:'s26',name:'IRONMAN Nice',date:'2026-09-06',loc:'ニース',country:'フランス',dist:'ロング',cat:'IRONMAN WC',source:'Static'},
    {id:'s27',name:'IRONMAN World Championship',date:'2026-10-10',loc:'コナ',country:'アメリカ',dist:'ロング',cat:'IRONMAN WC',source:'Static'},
    {id:'s30',name:'Challenge Taiwan',date:'2026-04-26',loc:'台東',country:'台湾',dist:'ロング',cat:'Challenge',source:'Static'},
    {id:'s31',name:'Challenge Roth',date:'2026-07-05',loc:'ロート',country:'ドイツ',dist:'ロング',cat:'Challenge',source:'Static'},
    {id:'s40',name:'T100 Singapore',date:'2026-02-28',loc:'シンガポール',country:'シンガポール',dist:'ミドル',cat:'T100',source:'Static'},
    {id:'s41',name:'T100 Gold Coast',date:'2026-03-21',loc:'ゴールドコースト',country:'オーストラリア',dist:'ミドル',cat:'T100',source:'Static'},
    {id:'s50',name:'XTERRA Japan',date:'2026-05-16',loc:'長野県',country:'日本',dist:'オフロード',cat:'XTERRA',source:'Static'}
  ]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const staticRaces = getStaticRaces()
    const today = new Date().toISOString().split('T')[0]
    const futureRaces = staticRaces.filter(r => r.date >= today).sort((a, b) => a.date.localeCompare(b.date))

    const japanCount = futureRaces.filter(r => r.country === '日本').length
    const overseasCount = futureRaces.filter(r => r.country !== '日本').length

    return res.status(200).json({
      success: true,
      count: futureRaces.length,
      japanCount,
      overseasCount,
      lastUpdated: new Date().toISOString(),
      races: futureRaces
    })

  } catch (error) {
    console.error('Handler error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
