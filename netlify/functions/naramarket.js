/**
 * Netlify Function: naramarket.js
 * 나라장터 (G2B) 공고 조회 — 조달청 공공데이터포털 Open API
 * 엔드포인트: /api/naramarket
 *
 * 환경변수(Netlify Dashboard > Site > Environment Variables):
 *   NARA_API_KEY  — 공공데이터포털 발급 인증키 (URL 인코딩 전 원문)
 */

const https = require('https');

const BASE_HOST = 'apis.data.go.kr';
// XML 전용 엔드포인트 사용 (type=json 파라미터 제거)
const BID_PATH  = '/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc';

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

/** XML 태그 값 추출 */
function getTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return '';
  return m[1]
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * 날짜 문자열 정규화 → yyyyMMdd (8자리)
 * 입력 예시: "2025/07/14 18:00", "20250714", "20250714180000"
 */
function normalizeDate(raw) {
  if (!raw) return '';
  // 숫자만 추출
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length >= 8) return digits.slice(0, 8);
  return '';
}

function parseResponse(body) {
  try {
    // API 오류 메시지 감지
    const resultCode = getTag(body, 'resultCode') || getTag(body, 'cmmMsgHeader>errMsg');
    const errMsg = getTag(body, 'errMsg');
    if (errMsg && errMsg !== 'OK' && errMsg !== '정상') {
      return { items: [], totalCount: 0, apiError: errMsg };
    }

    const items = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      const b = m[1];

      const startRaw = getTag(b, 'bidNtceDt');
      const endRaw   = getTag(b, 'bidClseDt');

      items.push({
        pblancNm:    getTag(b, 'bidNtceNm')            || '',
        pblancUrl:   getTag(b, 'bidNtceUrl')            || 'https://www.g2b.go.kr',
        jrsdInsttNm: getTag(b, 'ntceInsttNm')           || '',
        excInsttNm:  getTag(b, 'dminsttNm')             || '',
        category:    getTag(b, 'pubPrcrmntLrgClsfcNm')  || getTag(b, 'srvceDivNm') || '용역',
        region:      getTag(b, 'ntceInsttOfclNm')        || '전국',
        startDe:     normalizeDate(startRaw),
        endDe:       normalizeDate(endRaw),
        target:      getTag(b, 'cntrctCnclsMthdNm')     || '',
        source:      '나라장터',
      });
    }

    const totalCount = (
      body.match(/<totalCount>([\s\S]*?)<\/totalCount>/)?.[1]?.trim() || String(items.length)
    );
    return { items, totalCount };
  } catch (e) {
    return { items: [], totalCount: 0, parseError: e.message };
  }
}

exports.handler = async event => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const KEY = process.env.NARA_API_KEY || '';
  if (!KEY) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        items: [],
        totalCount: 0,
        warning: 'NARA_API_KEY 환경변수를 설정해주세요.',
      }),
    };
  }

  const p = event.queryStringParameters || {};
  const pageNo    = p.pageNo    || '1';
  const numOfRows = p.numOfRows || '30';

  // 날짜 범위: 오늘 ~ 한 달 후 (yyyyMMddHHmm 형식)
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}`;
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);
  const inqryBgnDt = fmt(now);
  const inqryEndDt = fmt(end);

  // ★ type=json 제거 — 나라장터 API는 항상 XML 반환
  const url =
    `https://${BASE_HOST}${BID_PATH}` +
    `?serviceKey=${encodeURIComponent(KEY)}` +
    `&pageNo=${pageNo}&numOfRows=${numOfRows}` +
    `&inqryDiv=1&inqryBgnDt=${inqryBgnDt}&inqryEndDt=${inqryEndDt}`;

  try {
    const res = await httpsGet(url);
    if (res.status !== 200) {
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({
          error: `Upstream ${res.status}`,
          raw: res.body.slice(0, 500),
        }),
      };
    }

    // XML 응답인지 확인 후 파싱
    const isXml = res.body.trimStart().startsWith('<');
    if (!isXml) {
      // JSON 응답인 경우 (예외적 상황)
      try {
        const json = JSON.parse(res.body);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ items: [], totalCount: 0, raw: json }),
        };
      } catch {
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ error: '알 수 없는 응답 형식', raw: res.body.slice(0, 300) }),
        };
      }
    }

    const data = parseResponse(res.body);
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message }) };
  }
};
