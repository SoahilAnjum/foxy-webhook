import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    const body = req.body;
    console.log('Webhook received:', body);

    const airtableUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(process.env.AIRTABLE_TABLE_NAME)}`;

    const response = await fetch(airtableUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              Email: body.email || 'no-email',
              Name: body.name || 'unknown',
              Timestamp: new Date().toISOString(),
            },
          },
        ],
      }),
    });

    const data = await response.json();
    console.log('Airtable response:', data);

    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('❌ Webhook error:', err);
    res.status(500).json({ message: 'Webhook processing failed', error: err.message });
  }
}
