// workers/ai.js  (Cloudflare Workers 버전)

export default {
  async fetch(request, env) {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    let prompt = '';
    try { prompt = (await request.json()).prompt || ''; } catch {}

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'prompt required' }),
        { status: 400, headers }
      );
    }

    const GROQ_KEY = env.GROQ_API_KEY;
    if (!GROQ_KEY) {
      return new Response(
        JSON.stringify({ result: '⚠️ GROQ_API_KEY 환경변수를 설정해주세요.' }),
        { status: 200, headers }
      );
    }

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error?.message || '알 수 없는 오류';
        return new Response(
          JSON.stringify({ result: `⚠️ Groq 오류 (${res.status}): ${msg}` }),
          { status: 200, headers }
        );
      }

      const result = data.choices?.[0]?.message?.content || '결과를 가져오지 못했어요.';
      return new Response(JSON.stringify({ result }), { status: 200, headers });

    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 502, headers }
      );
    }
  }
};
