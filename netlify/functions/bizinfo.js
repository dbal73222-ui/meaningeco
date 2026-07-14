const https = require('https');

const API_KEY = '2301e3f5202350fe07f8ec100c3b54f0730095626136f833d819c9f9ce43b265';
const BASE_URL = 'apis.data.go.kr';
const API_PATH = '/B552735/kisedKstartupService01/getAnnouncementInformation';

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
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

  const url = `https://${BASE_URL}${API_PATH}?serviceKey=${API_KEY}&pageNo=${pageNo}&numOfRows=${numOfRows}&dataType=json`;

  try {
    const res = await httpsGet(url);
    // 응답 그대로 전달 (디버깅용)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: res.status, raw: res.body.slice(0, 1000) })
    };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message }) };
  }
};
