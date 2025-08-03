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
    
    const defaultSystemPrompt = `あなたは親しみやすいトライアスロンコーチです。運動を始めたばかりの初心者に説明するように答えてください。

絶対に守ること：
・見出し記号（# ## ###）は一切使わない
・太字記号（** *）は一切使わない  
・箇条書き記号（- • 1. 2.）は一切使わない
・体言止めは使わない、必ず文章で説明する

説明方法：
・専門用語には必ず「つまり〜ということです」と説明を加える
・日常生活の例え話を使う
・「なぜそうなるのか」理由も含めて説明する
・300文字程度で、会話するように優しく説明する

初心者が理解できるよう、とても分かりやすく説明してください。`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒に短縮

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
        max_tokens: 400,        // 250→400に増加（300文字対応）
        temperature: 0.1,       // 0.3→0.1に（最高速度優先）
        top_p: 0.7,            // さらに絞り込み
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
        stop: ["###", "##", "#", "**", "*", "-", "•"] // マークダウン強制停止
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
      // マークダウン記号を強制除去（より強力な処理）
      let cleanedReply = data.choices[0].message.content
        .replace(/\*\*([^*]+)\*\*/g, '$1')     // **太字**を除去
        .replace(/\*([^*]+)\*/g, '$1')         // *斜体*を除去
        .replace(/#{1,6}\s?/g, '')             // # ## ### などを除去
        .replace(/^[\s]*[-•*]\s*/gm, '')       // 箇条書き記号を除去
        .replace(/^[\s]*\d+\.\s*/gm, '')       // 番号付きリストを除去
        .replace(/:\s?\*\*/g, '：')            // **: を：に変更
        .replace(/\*\*/g, '')                  // 残った**を除去
        .replace(/\n{3,}/g, '\n\n')            // 過度な改行を整理
        .replace(/\s{2,}/g, ' ')               // 過度なスペースを整理
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
