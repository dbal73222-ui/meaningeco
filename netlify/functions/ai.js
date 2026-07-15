const https = require("https");

const GEMINI_KEY = process.env.GEMINI_API_KEY;

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve({
          status: res.statusCode,
          body: data,
        });
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

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
    prompt = JSON.parse(event.body).prompt;
  } catch {
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
너는 정부지원사업 전문 컨설턴트이다.

다음 공고를 분석하여 아래 JSON 형식으로 응답한다.

{
"summary":"",
"eligibility":"",
"evaluation":"",
"checklist":"",
"proposal":""
}

공고

${prompt}
`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    };

    const response = await request(
      {
        hostname: "generativelanguage.googleapis.com",
        path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
      body
    );

    console.log("Gemini Status:", response.status);
    console.log(response.body);

    if (response.status !== 200) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          result: `Gemini 오류 (${response.status})`,
        }),
      };
    }

    const data = JSON.parse(response.body);

    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ??
      "응답을 생성하지 못했습니다.";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        result: text,
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
