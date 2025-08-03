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
    
    const defaultSystemPrompt = `あなたは親しみやすいトライアスロンコーチです。

絶対に守ること：
- 見出し記号は使わない（#、##、###など）
- 太字記号は使わない（**、*など）
- 箇条書きは使わない（1.、2.、-、•など）
- 体言止めは禁止、必ず文章で説明する

回答方法：
運動初心者にも分かるよう、専門用語は「つまり○○ということです」と説明する。日常の例えを使って、会話するように優しく300文字程度で答える。

普通の文章だけで、とても分かりやすく説明してください。`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

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
        max_tokens: 400,
        temperature: 0.3,
        top_p: 0.8,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      return res.status(response.status).json({ 
        error: errorData.error?.message || 'OpenAI API Error' 
      });
    }
    
    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      // 強力なマークダウン除去
      let cleanedReply = data.choices[0].message.content
        .replace(/\*\*([^*]*)\*\*/g, '$1')     // **太字**
        .replace(/\*([^*]*)\*/g, '$1')         // *斜体*
        .replace(/#{1,6}\s*/g, '')             // ##### などの見出し
        .replace(/^[\s]*[-•*+]\s+/gm, '')      // - • * + の箇条書き
        .replace(/^[\s]*\d+\.\s+/gm, '')       // 1. 2. 3. の番号付き
        .replace(/^\s*[\-\*]{3,}\s*$/gm, '')   // --- *** の区切り線
        .replace(/\n{3,}/g, '\n\n')            // 過度な改行
        .trim();
      
      return res.status(200).json({ 
        reply: cleanedReply 
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
