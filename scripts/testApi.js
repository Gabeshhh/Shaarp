async function main() {
  const r = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'https://www.mwcbarcelona.com/exhibitors' }],
    }),
  });

  console.log('status:', r.status);
  console.log('content-type:', r.headers.get('content-type'));
  console.log('x-scrape-stream:', r.headers.get('x-scrape-stream'));
  const text = await r.text();
  console.log(text.slice(0, 1000));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

