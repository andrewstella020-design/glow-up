export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const msg = body.messages[0];
    const content = msg.content;
    const parts = [];

    if (typeof content === "string") {
      parts.push({ text: content });
    } else {
      for (const block of content) {
        if (block.type === "text") parts.push({ text: block.text });
        if (block.type === "image") {
          parts.push({ inline_data: { mime_type: block.source.media_type, data: block.source.data } });
        }
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { maxOutputTokens: body.max_tokens || 500 },
        }),
      }
    );

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") ||
      data.error?.message ||
      "";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: [{ type: "text", text }] }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
                }
