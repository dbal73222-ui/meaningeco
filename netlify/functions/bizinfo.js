const API_KEY = '2301e3f5202350fe07f8ec100c3b54f0730095626136f833d819c9f9ce43b265';
const BASE_URL = 'https://apis.data.go.kr/1130000/MsmeSbizPblanc/getMsmeSbizPblanc';

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

  const url =
    `${BASE_URL}?serviceKey=${API_KEY}` +
    `&pageNo=${pageNo}&numOfRows=${numOfRows}&dataType=json`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({ error: `Upstream error: ${res.status}` }),
      };
    }
    const data = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    console.error('bizinfo proxy error:', err);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Proxy fetch failed', detail: err.message }),
    };
  }
};
