/**
 * Netlify Function: bizinfo2.js
 * 기업마당 (중소벤처기업부) 지원사업 공고 조회
 * 엔드포인트: /api/bizinfo2
 *
 * 환경변수(Netlify Dashboard > Site > Environment Variables):
 *   BIZ_API_KEY  — 공공데이터포털 발급 인증키
 *
 * 문서: https://www.bizinfo.go.kr/web/lay1/bBS/S1T122C128/openapi/openapi.do
 */

const https = require('https');

const BASE_HOST = 'apis.data.go.kr';
const BIZ_PATH  = '/1130000/FrcnEntrprmInfoService/getFrcnEntrprmInfo';

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

/** XML → JSON 변환 (기업마당 API는 XML 반환) */
function getTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();
}

function parseXML(body) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const b = m[1];
    items.push({
      pblancNm:    getTag(b, 'pblancNm')    || getTag(b, 'frcnEntrprmNm') || '',
      pblancUrl:   getTag(b, 'detlPgUrl')   || 'https://www.bizinfo.go.kr',
      jrsdInsttNm: getTag(b, 'jrsdInsttNm') || getTag(b, 'mnofcInsttNm') || '',
      excInsttNm:  getTag(b, 'excInsttNm')  || '',
      category:    getTag(b, 'bsnsSportCn')  || getTag(b, 'intgPbancBizNm') || '지원사업',
      region:      getTag(b, 'rgnNm')        || '전국',
      startDe:     getTag(b, 'rcptBgngDe')  || getTag(b, 'pbancBgngDt') || '',
      endDe:       getTag(b, 'rcptEdDe')    || getTag(b, 'pbancEndDt') || '',
      target:      getTag(b, 'trgtNm')      || '',
      source:      '기업마당',
    });
  }
  const totalCount = body.match(/<totalCount>([\s\S]*?)<\/totalCount>/)?.[1]?.trim() || String(items.length);
  return { items, totalCount };
}

exports.handler = async event => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const KEY = process.env.BIZ_API_KEY || '';
  if (!KEY) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ items: [], totalCount: 0, warning: 'BIZ_API_KEY 환경변수를 설정해주세요.' }),
    };
  }

  const p = event.queryStringParameters || {};
  const pageNo    = p.pageNo    || '1';
  const numOfRows = p.numOfRows || '30';

  const url = `https://${BASE_HOST}${BIZ_PATH}?serviceKey=${encodeURIComponent(KEY)}`
            + `&pageNo=${pageNo}&numOfRows=${numOfRows}`;

  try {
    const res = await httpsGet(url);
    if (res.status !== 200) {
      return { statusCode: res.status, headers, body: JSON.stringify({ error: `Upstream ${res.status}`, raw: res.body.slice(0, 300) }) };
    }
    const data = parseXML(res.body);
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message }) };
  }
};
