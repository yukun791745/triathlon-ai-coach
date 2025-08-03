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
    
    const defaultSystemPrompt = `トライアスロンコーチとして答えてください。

重要な制約：
記号類は一切使用禁止です。見出し、太字、箇条書きなどのマークダウン記号は絶対に使わないでください。

回答形式：
運動初心者向けに、普通の文章のみで説明してください。専門用語には必ず分かりやすい説明を加えてください。

このルールを必ず守ってください。`;

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
            content: message + "\n\n注意：マークダウン記号（#、**、-、1.など）は一切使わず、普通の文章のみで回答してください。"
          }
        ],
        max_tokens: 500,
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
      // 非常に強力なマークダウン除去
      let cleanedReply = data.choices[0].message.content
        .replace(/\*\*([^*]*)\*\*/g, '$1')           // **太字**
        .replace(/\*([^*]*)\*/g, '$1')               // *斜体*
        .replace(/#{1,6}\s*/g, '')                   // ### 見出し
        .replace(/^[\s]*[-•*+]\s+/gm, '')            // - 箇条書き
        .replace(/^[\s]*\d+\.\s+/gm, '')             // 1. 番号付き
        .replace(/^\s*[\-\*_]{3,}\s*$/gm, '')        // --- 区切り線
        .replace(/\*\*([^*]*)\*\*/g, '')             // 残った**
        .replace(/\*/g, '')                          // 残った*
        .replace(/#+/g, '')                          // 残った#
        .replace(/\n{3,}/g, '\n\n')                  // 過度な改行
        .replace(/：\s*\*/g, '：')                   // ：*の組み合わせ
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
