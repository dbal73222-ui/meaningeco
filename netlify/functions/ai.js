const https = require('https');

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

function httpsPost(host, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: host, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
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

  if (!GEMINI_KEY) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ result: '⚠️ GEMINI_API_KEY 환경변수를 Netlify에 설정해주세요.' })
    };
  }

  try {
    const res = await httpsPost(
      'generativelanguage.googleapis.com',
      `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        systemInstruction: {
          parts: [{ text: '당신은 정부 지원사업 전문가이자 스타트업 사업계획서 컨설턴트입니다. 미닝에코(AI 기반 콘텐츠·행사 운영 스타트업)의 내부 AI 코파일럿으로, 간결하고 실무적인 답변을 한국어로 제공합니다.' }]
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.4 }
      }
    );

    const data = JSON.parse(res.body);
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || '결과를 가져오지 못했어요.';
    return { statusCode: 200, headers, body: JSON.stringify({ result }) };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message }) };
  }
};
