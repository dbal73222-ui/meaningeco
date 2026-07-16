const https = require('https');

const GROQ_KEY = process.env.GROQ_API_KEY || '';

function httpsPost(host, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: host, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers }
    }, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  let prompt = '';
  try { prompt = JSON.parse(event.body).prompt || ''; } catch {}
  if (!prompt) return { statusCode: 400, headers, body: JSON.stringify({ error: 'prompt required' }) };

  if (!GROQ_KEY) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ result: '⚠️ GROQ_API_KEY 환경변수를 Netlify에 설정해주세요.' })
    };
  }

  try {
    const res = await httpsPost(
      'api.groq.com',
      '/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: '당신은 정부 지원사업 전문가이자 스타트업 사업계획서 컨설턴트입니다. 미닝에코(AI 기반 콘텐츠·행사 운영 스타트업)의 내부 AI 코파일럿으로, 간결하고 실무적인 답변을 한국어로 제공합니다.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.4,
      },
      { 'Authorization': `Bearer ${GROQ_KEY}` }
    );

    const data = JSON.parse(res.body);
    console.log('Groq status:', res.status);
    console.log('Groq response:', JSON.stringify(data).slice(0, 500));

    if (res.status !== 200) {
      const msg = data.error?.message || '알 수 없는 오류';
      return { statusCode: 200, headers, body: JSON.stringify({ result: `⚠️ Groq 오류 (${res.status}): ${msg}` }) };
    }

    const result = data.choices?.[0]?.message?.content || '결과를 가져오지 못했어요.';
    return { statusCode: 200, headers, body: JSON.stringify({ result }) };

  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message }) };
  }
};
