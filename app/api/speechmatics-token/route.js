// Gets a short-lived JWT from Speechmatics for browser WebSocket connection.
// Uses the official Speechmatics auth endpoint.
export async function POST(request) {
  const apiKey = process.env.SPEECHMATICS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'SPEECHMATICS_API_KEY not set' }, { status: 500 });
  }

  try {
    const res = await fetch('https://mp.speechmatics.com/v1/api_keys?type=rt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ttl: 3600 }), // 1 hour token
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Speechmatics token error:', res.status, text);
      return Response.json({ error: `Token error: ${res.status} - ${text}` }, { status: res.status });
    }

    const data = await res.json();
    return Response.json({ key_value: data.key_value });
  } catch (err) {
    console.error('Token fetch error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
