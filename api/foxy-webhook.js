import crypto from "crypto";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    // === Verify signature (recommended)
    const signature = req.headers["x-foxy-signature"];
    const secret = process.env.FOXY_SECRET; // ✅ Correct variable name
    const rawBody = JSON.stringify(req.body);

    const computed = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (signature !== computed) {
      return res.status(401).send("Invalid signature");
    }

    // === Find subscription link
    const embedded = req.body._embedded || {};
    const links = req.body._links || {};
    let subscriptionUrl = null;

    if (links["fx:subscription"]) {
      subscriptionUrl = links["fx:subscription"].href;
    } else if (
      embedded["fx:subscriptions"] &&
      embedded["fx:subscriptions"][0]
    ) {
      subscriptionUrl = embedded["fx:subscriptions"][0]._links.self.href;
    }

    if (!subscriptionUrl) {
      console.log("⚠️ No subscription link found in webhook payload");
      return res.status(200).send("No subscription found");
    }

    // === Fetch subscription data from Foxy
    const response = await fetch(subscriptionUrl, {
      headers: {
        Authorization: `Bearer ${process.env.FOXY_ACCESS_TOKEN}`,
        "FOXY-API-VERSION": "1",
        Accept: "application/json",
      },
    });

    const subscription = await response.json();
    console.log("✅ Subscription details:", subscription);

    // === Extract customer info
    let customerName = "";
    let customerEmail = "";
    if (subscription._embedded && subscription._embedded["fx:customer"]) {
      customerName = subscription._embedded["fx:customer"].first_name || "";
      customerEmail = subscription._embedded["fx:customer"].email || "";
    }

    // === Extract product info
    const productName = subscription.item_name || "N/A";
    const price = subscription.price || 0;
    const subscriptionId = subscription.id || "N/A";

    // === Save to Airtable (using new API)
    const airtableUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(
      process.env.AIRTABLE_TABLE_NAME
    )}`;

    const airtableData = {
      records: [
        {
          fields: {
            Name: customerName,
            Email: customerEmail,
            Product: productName,
            Price: price,
            "Subscription ID": subscriptionId,
            "Created Date": new Date().toISOString(),
          },
        },
      ],
    };

    const airtableResponse = await fetch(airtableUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(airtableData),
    });

    if (!airtableResponse.ok) {
      const errorText = await airtableResponse.text();
      console.error("❌ Airtable Error:", errorText);
      throw new Error("Failed to save to Airtable");
    }

    console.log("✅ Saved to Airtable successfully");
    res.status(200).send("Webhook processed successfully");
  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.status(500).send("Webhook processing failed");
  }
}
