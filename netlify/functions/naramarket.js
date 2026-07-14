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
const BID_PATH  = '/1230000/BidPublicInfoService04/getBidPblancListInfoServc';  // 서비스 입찰공고

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

/** JSON 응답 파싱 (나라장터는 JSON 지원) */
function parseResponse(body) {
  try {
    const json = JSON.parse(body);
    const items = json?.response?.body?.items?.item || [];
    const totalCount = json?.response?.body?.totalCount || 0;
    // 배열이 아닌 단건일 때 대비
    const list = Array.isArray(items) ? items : [items];
    return {
      items: list.map(it => ({
        pblancNm:    it.bidNtceNm      || '',
        pblancUrl:   it.bidNtceUrl     || `https://www.g2b.go.kr`,
        jrsdInsttNm: it.ntceInsttNm   || '',
        excInsttNm:  it.dminsttNm     || '',
        category:    it.prdctClsfcNm  || it.ntceKindNm || '조달',
        region:      it.ntceInsttOfclNm || '전국',
        startDe:     (it.bidNtceDt||'').replace(/[^0-9]/g,'').slice(0,8),
        endDe:       (it.bidClseDt||'').replace(/[^0-9]/g,'').slice(0,8),
        target:      it.reqrmnDcmntNm || '',
        source:      '나라장터',
      })),
      totalCount,
    };
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
            + `&pageNo=${pageNo}&numOfRows=${numOfRows}&type=json`
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
