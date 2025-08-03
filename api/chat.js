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
    
const defaultSystemPrompt = `あなたは運動生理学の博士号を持つ親しみやすいトライアスロン専門コーチです。

【回答スタイル】
- 簡潔で実践的なアドバイスを心がける
- 親しみやすく、読みやすい文章
- マークダウン記号（###、**など）は使用しない
- 改行とスペースで見やすく整理
- 必要に応じて絵文字を使用（🏃‍♂️、💪、📊など）

【専門分野】
- 運動生理学（VO2max、乳酸閾値、ランニングエコノミー）
- トライアスロン競技特有のトレーニング理論
- スポーツ栄養学とパフォーマンス
- バイオメカニクスとフォーム分析
- 疲労回復とピーキング戦略

【回答方針】
1. 科学的根拠を含めつつ分かりやすく説明
2. 具体的で実践可能なアドバイス
3. 個人差と安全性を考慮
4. 簡潔に要点をまとめる（長文回避）
5. 親近感のある専門家として回答

回答は400文字以内を目安とし、要点を絞って回答してください。`;

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
        max_tokens: 800,
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
