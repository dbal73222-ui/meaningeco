const https = require("https");

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

function httpsPost(host, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);

    const req = https.request(
      {
        hostname: host,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let out = "";

        res.on("data", (chunk) => {
          out += chunk;
        });

        res.on("end", () => {
          resolve({
            status: res.statusCode,
            body: out,
          });
        });
      }
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  if (!GEMINI_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        result: "GEMINI_API_KEY가 설정되지 않았습니다.",
      }),
    };
  }

  let prompt = "";

  try {
    prompt = JSON.parse(event.body).prompt || "";
  } catch {}

  if (!prompt) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        result: "prompt required",
      }),
    };
  }

  try {
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
당신은 정부지원사업 전문 컨설턴트입니다.

다음 공고를 분석하여 아래 항목을 한국어로 작성하세요.

1. 공고 요약
2. 신청 자격
3. 평가 기준 분석
4. 신청 체크리스트
5. 사업계획서 초안

공고 내용

${prompt}
`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        topP: 0.95,
        maxOutputTokens: 4096,
      },
    };

    const res = await httpsPost(
      "generativelanguage.googleapis.com",
      `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      body
    );

    console.log("Gemini Status:", res.status);
    console.log(res.body);

    const data = JSON.parse(res.body);

    if (res.status !== 200) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          result: `Gemini 오류 (${res.status})\n${JSON.stringify(data)}`,
        }),
      };
    }

    const candidate = data.candidates?.[0];

    if (!candidate) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          result: "Gemini가 응답을 반환하지 않았습니다.",
        }),
      };
    }

    const result =
      candidate.content?.parts
        ?.map((p) => p.text || "")
        .join("\n") || "결과를 가져오지 못했습니다.";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        result,
      }),
    };
  } catch (err) {
    console.error(err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        result: err.message,
      }),
    };
  }
};
