// workers/sheets.js  (Cloudflare Workers 버전)

export default {
  async fetch(request, env) {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const WEBHOOK_URL = env.SHEETS_WEBHOOK_URL;

    if (!WEBHOOK_URL) {
      return new Response(
        JSON.stringify({ ok: false, error: 'SHEETS_WEBHOOK_URL 환경변수가 설정되지 않았어요.' }),
        { status: 200, headers }
      );
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid JSON' }),
        { status: 400, headers }
      );
    }

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'follow',  // Apps Script 302 리디렉션 자동 처리
      });

      let result = { ok: true };
      try { result = await res.json(); } catch {}

      return new Response(JSON.stringify(result), { status: 200, headers });
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: err.message }),
        { status: 502, headers }
      );
    }
  }
};
