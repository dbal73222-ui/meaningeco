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
const BID_PATH  = '/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc';  // 서비스 입찰공고

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

/** XML 응답 파싱 */
function getTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();
}

function parseResponse(body) {
  try {
    const items = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      const b = m[1];
      items.push({
        pblancNm:    getTag(b, 'bidNtceNm')          || '',
        pblancNo:    getTag(b, 'bidNtceNo')           || '',
        pblancUrl:   getTag(b, 'bidNtceUrl')          || 'https://www.g2b.go.kr',
        jrsdInsttNm: getTag(b, 'ntceInsttNm')         || '',
        excInsttNm:  getTag(b, 'dminsttNm')           || '',
        category:    getTag(b, 'pubPrcrmntLrgClsfcNm') || getTag(b, 'srvceDivNm') || '용역',
        region:      getTag(b, 'ntceInsttOfclNm')      || '전국',
        startDe:     (getTag(b, 'bidNtceDt') || '').replace(/[^0-9]/g, '').slice(0, 8),
        endDe:       (getTag(b, 'bidClseDt') || '').replace(/[^0-9]/g, '').slice(0, 8),
        target:      getTag(b, 'cntrctCnclsMthdNm')   || '',
        budget:      getTag(b, 'presmptPrce')          || '',
        bidMethod:   getTag(b, 'bidMethdNm')           || '',
        submitMethod:getTag(b, 'bidNtceMthdNm')        || '',
        source:      '나라장터',
      });
    }
    const totalCount = body.match(/<totalCount>([\s\S]*?)<\/totalCount>/)?.[1]?.trim() || '0';
    return { items, totalCount };
  } catch {
    return { items: [], totalCount: 0 };
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
      statusCode: 200, headers,
      body: JSON.stringify({ items: [], totalCount: 0, warning: 'NARA_API_KEY 환경변수를 설정해주세요.' }),
    };
  }

  const p = event.queryStringParameters || {};
  const pageNo    = p.pageNo    || '1';
  const numOfRows = p.numOfRows || '30';

  // 날짜 범위: 오늘 ~ 한 달 후 (yyyyMMddHHmm 형식)
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
  const end = new Date(now); end.setMonth(end.getMonth() + 1);
  const inqryBgnDt = fmt(now);
  const inqryEndDt = fmt(end);

  const url = `https://${BASE_HOST}${BID_PATH}?serviceKey=${encodeURIComponent(KEY)}`
            + `&pageNo=${pageNo}&numOfRows=${numOfRows}`
            + `&inqryDiv=1&inqryBgnDt=${inqryBgnDt}&inqryEndDt=${inqryEndDt}`;

  try {
    const res = await httpsGet(url);
    if (res.status !== 200) {
      return { statusCode: res.status, headers, body: JSON.stringify({ error: `Upstream ${res.status}`, raw: res.body.slice(0, 300) }) };
    }
    const data = parseResponse(res.body);
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message }) };
  }
};
