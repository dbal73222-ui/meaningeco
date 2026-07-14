const https = require('https');

const API_KEY = '2301e3f5202350fe07f8ec100c3b54f0730095626136f833d819c9f9ce43b265';
const BASE_URL = 'apis.data.go.kr';
const API_PATH = '/B552735/kisedKstartupService01/getAnnouncementInformation01';

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
  const getCol = (block, name) => {
    const re = new RegExp(`<col name="${name}">([\\s\\S]*?)<\\/col>`);
    const m = block.match(re);
    if (!m) return '';
    return m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();
  };

  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRe.exec(xml)) !== null) {
    const b = match[1];
    items.push({
      pblancNm:    getCol(b, 'biz_pbanc_nm'),
      pblancUrl:   getCol(b, 'detl_pg_url'),
      jrsdInsttNm: getCol(b, 'pbanc_ntrp_nm'),
      excInsttNm:  getCol(b, 'intg_pbanc_biz_nm'),
      category:    getCol(b, 'supt_biz_clsfc'),
      region:      getCol(b, 'supt_regin'),
      startDe:     getCol(b, 'pbanc_rcpt_bgng_dt'),
      endDe:       getCol(b, 'pbanc_rcpt_clsng_dt'),
      target:      getCol(b, 'aply_trgt_ctnt'),
    });
  }

  const totalCount = xml.match(/<totalCount>([\s\S]*?)<\/totalCount>/)?.[1]?.trim()
    || xml.match(/<currentCount>([\s\S]*?)<\/currentCount>/)?.[1]?.trim()
    || '0';

  return { items, totalCount };
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
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message }) };
  }
};
