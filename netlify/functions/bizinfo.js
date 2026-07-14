const API_KEY = '2301e3f5202350fe07f8ec100c3b54f0730095626136f833d819c9f9ce43b265';
const BASE_URL = 'https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService';

function parseXML(xml) {
  const getTag = (str, tag) => {
    const matches = [];
    const re = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'g');
    let m;
    while ((m = re.exec(str)) !== null) {
      matches.push(m[0].replace(`<${tag}>`, '').replace(`</${tag}>`, '').trim());
    }
    return matches;
  };

  const getVal = (str, tag) => {
    const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`);
    const m = str.match(re);
    return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
  };

  // item 블록 추출
  const itemBlocks = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    itemBlocks.push({
      pblancNm:                    getVal(block, 'pblancNm'),
      pblancUrl:                   getVal(block, 'pblancUrl'),
      pblancId:                    getVal(block, 'pblancId'),
      jrsdInsttNm:                 getVal(block, 'jrsdInsttNm'),
      excInsttNm:                  getVal(block, 'excInsttNm'),
      pldirSportRealmLclasCodeNm:  getVal(block, 'pldirSportRealmLclasCodeNm'),
      reqstBeginEndDe:             getVal(block, 'reqstBeginEndDe'),
      rceptEngnHmpgUrl:            getVal(block, 'rceptEngnHmpgUrl'),
    });
  }

  const totalCount = xml.match(/<totalCount>([\s\S]*?)<\/totalCount>/)?.[1]?.trim() || '0';
  return { items: itemBlocks, totalCount };
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

  const url = `${BASE_URL}?serviceKey=${API_KEY}&pageNo=${pageNo}&numOfRows=${numOfRows}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { statusCode: res.status, headers, body: JSON.stringify({ error: `Upstream error: ${res.status}` }) };
    }
    const xml  = await res.text();
    const data = parseXML(xml);
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Proxy fetch failed', detail: err.message }) };
  }
};
