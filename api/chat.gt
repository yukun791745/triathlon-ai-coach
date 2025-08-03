export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { message, apiKey, systemPrompt } = req.body;
    
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return res.status(400).json({ error: 'Invalid API key' });
    }
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const defaultSystemPrompt = `あなたは運動生理学の博士号を持つトライアスロン専門コーチです。以下の専門知識を活用して、科学的根拠に基づいた実践的なアドバイスを提供してください：

【専門分野】
- 運動生理学（VO2max、乳酸閾値、ランニングエコノミー）
- トライアスロン競技特有のトレーニング理論
- スポーツ栄養学とパフォーマンス
- バイオメカニクスとフォーム分析
- 疲労回復とピーキング戦略
- 遺伝的要因とトレーニング応答性

【回答方針】
1. 必ず科学的根拠（研究論文、生理学的メカニズム）を含める
2. 具体的で実践可能なアドバイスを提供
3. 個人差と安全性を常に考慮
4. 最新の運動生理学研究を反映
5. 専門用語を使いつつ分かりやすく説明`;

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
            content: systemPrompt || defaultSystemPrompt 
          },
          { 
            role: 'user', 
            content: message 
          }
        ],
        max_tokens: 1500,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      return res.status(response.status).json({ 
        error: errorData.error?.message || 'OpenAI API Error' 
      });
    }
    
    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return res.status(200).json({ 
        reply: data.choices[0].message.content 
      });
    } else {
      return res.status(500).json({ 
        error: 'Invalid response from OpenAI API' 
      });
    }
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error: ' + error.message 
    });
  }
}
