import formidable from 'formidable';
import Airtable from 'airtable';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Initialize Airtable with OAuth token
const base = new Airtable({
  apiKey: process.env.AIRTABLE_TOKEN,
}).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data
    const form = formidable({ multiples: true });
    const data = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields) => {
        if (err) reject(err);
        else resolve(fields);
      });
    });

    const foxyDataRaw = data.FoxyData;
    if (!foxyDataRaw) {
      return res.status(400).json({ error: 'No FoxyData found in request' });
    }

    let foxyData;
    try {
      foxyData = JSON.parse(foxyDataRaw);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid FoxyData JSON' });
    }

    // Save record to Airtable
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
