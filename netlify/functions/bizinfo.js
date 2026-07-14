const https = require('https');

const API_KEY = '2301e3f5202350fe07f8ec100c3b54f0730095626136f833d819c9f9ce43b265';
const BASE_URL = 'apis.data.go.kr';
const API_PATH = '/1421000/bizinfo/pblancBsnsService';

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function parseXML(xml) {
  const getVal = (str, tag) => {
    const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`);
    const m = str.match(re);
    return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
  };

  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRe.exec(xml)) !== null) {
    const b = match[1];
    items.push({
      pblancNm:                   getVal(b, 'pblancNm'),
      pblancUrl:                  getVal(b, 'pblancUrl'),
      pblancId:                   getVal(b, 'pblancId'),
      jrsdInsttNm:                getVal(b, 'jrsdInsttNm'),
      excInsttNm:                 getVal(b, 'excInsttNm'),
      pldirSportRealmLclasCodeNm: getVal(b, 'pldirSportRealmLclasCodeNm'),
      reqstBeginEndDe:            getVal(b, 'reqstBeginEndDe'),
      rceptEngnHmpgUrl:           getVal(b, 'rceptEngnHmpgUrl'),
    });
  }

  return {
    items,
    totalCount: xml.match(/<totalCount>([\s\S]*?)<\/totalCount>/)?.[1]?.trim() || '0',
  };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const params = event.queryStringParameters || {};
  const pageNo    = params.pageNo    || '1';
  const numOfRows = params.numOfRows || '50';

  const url = `https://${BASE_URL}${API_PATH}?serviceKey=${API_KEY}&pageNo=${pageNo}&numOfRows=${numOfRows}`;

  try {
    const res = await httpsGet(url);
    if (res.status !== 200) {
      return { statusCode: res.status, headers, body: JSON.stringify({ error: `Upstream error: ${res.status}`, raw: res.body.slice(0, 300) }) };
    }
    const data = parseXML(res.body);
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Proxy fetch failed', detail: err.message }) };
  }
};
