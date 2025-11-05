import Airtable from 'airtable';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // disable body parser to handle form-data
  },
};

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the form-data from Foxy
    const form = formidable({ multiples: true });
    const data = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve(fields);
      });
    });

    // Foxy sends "FoxyData" field containing the actual JSON string
    const foxyDataRaw = data.FoxyData;
    if (!foxyDataRaw) {
      return res.status(400).json({ error: 'No FoxyData found in request' });
    }

    // Try parsing the FoxyData as JSON
    let foxyData;
    try {
      foxyData = JSON.parse(foxyDataRaw);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid FoxyData JSON' });
    }

    // ✅ Save the parsed Foxy data into Airtable
    await base('Subscriptions').create([
      {
        fields: {
          TransactionID: foxyData.id || '',
          CustomerEmail: foxyData.customer_email || '',
          Total: foxyData.total_order || '',
          Status: foxyData.status || '',
          RawData: JSON.stringify(foxyData),
        },
      },
    ]);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
