// 3. בדיקת Redis ו-AI (עם הגבלת כמות למניעת 429)
    let biasMap: Record<string, string> = await redis.hgetall('entity_bias_map') || {};
    
    // שולחים רק 5 שמות בכל פעם כדי לא לקבל 429
    const missing = Array.from(entities)
      .filter(e => !biasMap[e])
      .slice(0, 5); 

    if (missing.length > 0) {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`, 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-lite-preview-02-05:free', 
          messages: [{ 
            role: 'user', 
            content: `Return ONLY a JSON object: {"entity": "right/left/center"}. Entities: ${missing.join(', ')}` 
          }],
          seed: 42 // עוזר לעקביות ומניעת עומס
        })
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        aiDebug = content;

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const newBiases = JSON.parse(jsonMatch[0]);
            for (const [key, value] of Object.entries(newBiases)) {
              const cleanKey = String(key).trim();
              const cleanValue = String(value).toLowerCase().trim();
              await redis.hset('entity_bias_map', { [cleanKey]: cleanValue });
              biasMap[cleanKey] = cleanValue;
            }
          } catch (e) { console.error("JSON parse error"); }
        }
      } else {
        aiDebug = `AI Error: ${aiRes.status}`;
      }
    }
