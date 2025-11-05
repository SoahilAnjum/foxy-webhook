// api/foxy-webhook.js
import fetch from "node-fetch";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method Not Allowed" });
    }

    // Read raw body
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
      console.error("Invalid JSON:", rawBody);
      return res.status(400).json({ message: "Invalid JSON body" });
    }

    console.log("✅ Webhook received from Foxy:");
    console.log(JSON.stringify(body, null, 2));

    // Extract customer + subscription info
    const customer =
      body._embedded && body._embedded["fx:customer"]
        ? body._embedded["fx:customer"]
        : {};
    const subscription =
      body._embedded && body._embedded["fx:subscription"]
        ? body._embedded["fx:subscription"]
        : {};

    const name = customer.first_name || "Unknown";
    const email = customer.email || "No email";
    const product = subscription.item_name || "N/A";
    const price = subscription.price || "N/A";

    console.log("🧾 Extracted data:", { name, email, product, price });

    // Send to Airtable
    const airtableUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(
      process.env.AIRTABLE_TABLE_NAME
    )}`;

    const response = await fetch(airtableUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              Name: name,
              Email: email,
              Product: product,
              Price: price,
              Timestamp: new Date().toISOString(),
            },
          },
        ],
      }),
    });

    const airtableData = await response.json();
    console.log("Airtable API Response:", airtableData);

    if (!response.ok) {
      throw new Error(JSON.stringify(airtableData));
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).json({
      message: "Webhook processing failed",
      error: err.message,
    });
  }
}
