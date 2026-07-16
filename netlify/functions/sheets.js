// netlify/functions/sheets.js
// Apps Script 웹훅으로 판정 데이터를 Google Sheets에 전송하는 프록시
// 환경변수: SHEETS_WEBHOOK_URL (Apps Script 배포 URL)

const https = require('https');
const http  = require('http');

const WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL || '';

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data    = JSON.stringify(body);
    const parsed  = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib     = isHttps ? https : http;

    const req = lib.request({
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
      }
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

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (!WEBHOOK_URL) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ ok: false, error: 'SHEETS_WEBHOOK_URL 환경변수가 설정되지 않았어요.' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'invalid JSON' }) };
  }

  try {
    const res = await httpPost(WEBHOOK_URL, payload);
    // Apps Script는 리디렉션(302)을 내릴 수 있으므로 body 파싱 시도
    let result = { ok: true };
    try { result = JSON.parse(res.body); } catch {}
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
