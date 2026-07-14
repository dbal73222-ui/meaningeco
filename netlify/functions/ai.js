const https = require('https');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';

function httpsPost(host, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: host, path, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(data) }
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

  if (!ANTHROPIC_KEY) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ result: '⚠️ ANTHROPIC_API_KEY 환경변수를 Netlify에 설정해주세요.\n\nNetlify 대시보드 → Site Settings → Environment Variables → ANTHROPIC_API_KEY 추가' })
    };
  }

  try {
    const res = await httpsPost('api.anthropic.com', '/v1/messages', {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    }, {
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: '당신은 정부 지원사업 전문가이자 스타트업 사업계획서 컨설턴트입니다. 미닝에코(AI 기반 콘텐츠·행사 운영 스타트업)의 내부 AI 코파일럿으로, 간결하고 실무적인 답변을 한국어로 제공합니다.',
      messages: [{ role: 'user', content: prompt }]
    });

    const data = JSON.parse(res.body);
    const result = data.content?.[0]?.text || '결과를 가져오지 못했어요.';
    return { statusCode: 200, headers, body: JSON.stringify({ result }) };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message }) };
  }
};
