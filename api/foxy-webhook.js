// api/foxy-webhook.js
import fetch from "node-fetch";

export const config = {
  api: {
    bodyParser: false, // ❌ Disable default parser — we’ll handle it manually
  },
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method Not Allowed" });
    }

    // ✅ Read and safely parse raw body
    const rawBody = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
      req.on("error", (err) => reject(err));
    });

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error("Invalid JSON received:", rawBody);
      return res.status(400).json({ message: "Invalid JSON body" });
    }

    console.log("✅ Webhook received:", body);
    console.log("🔍 Airtable Debug:", {
  base: process.env.AIRTABLE_BASE_ID,
  table: process.env.AIRTABLE_TABLE_NAME,
  token: process.env.AIRTABLE_TOKEN ? "✅ Present" : "❌ Missing"
});

    // ✅ Airtable setup
    const airtableUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(
      process.env.AIRTABLE_TABLE_NAME
    )}`;

    const airtableResponse = await fetch(airtableUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              Email: body.email || "no-email",
              Name: body.name || "unknown",
              Timestamp: new Date().toISOString(),
            },
          },
        ],
      }),
    });

    const airtableData = await airtableResponse.json();
    console.log("Airtable response:", airtableData);

    if (!airtableResponse.ok) {
      throw new Error(JSON.stringify(airtableData));
    }

    res.status(200).json({ success: true, airtableData });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res
      .status(500)
      .json({ message: "Webhook processing failed", error: err.message });
  }
}
