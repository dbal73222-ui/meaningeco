const https = require("https");

const GEMINI_KEY = process.env.GEMINI_API_KEY;

function post(host, path, body) {
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

        res.on("data", (d) => (out += d));

        res.on("end", () =>
          resolve({
            status: res.statusCode,
            body: out,
          })
        );
      }
    );

    req.on("error", reject);

    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

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
        result: "GEMINI_API_KEY가 설정되어 있지 않습니다.",
      }),
    };
  }

  let prompt = "";

  try {
    const body = JSON.parse(event.body || "{}");
    prompt = body.prompt || "";
  } catch (e) {}

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
    const response = await post(
      "generativelanguage.googleapis.com",
      `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        systemInstruction: {
          parts: [
            {
              text:
                "당신은 정부지원사업 전문 컨설턴트입니다. " +
                "미닝에코의 입장에서 공고를 분석하고 " +
                "신청 자격, 핵심 요약, 사업계획서 방향을 한국어로 작성합니다.",
            },
          ],
        },

        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],

        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          maxOutputTokens: 1200,
        },
      }
    );

    console.log("Gemini Status :", response.status);
    console.log(response.body);

    const json = JSON.parse(response.body);

    if (response.status !== 200) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          result:
            `Gemini 오류 (${response.status})\n` +
            JSON.stringify(json),
        }),
      };
    }

    const text =
      json.candidates?.[0]?.content?.parts?.[0]?.text ||
      "결과를 가져오지 못했습니다.";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        result: text,
      }),
    };
  } catch (err) {
    console.log(err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        result: err.message,
      }),
    };
  }
};
