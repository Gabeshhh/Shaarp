async function main() {
  const r = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'bonjour' }],
    }),
  });

  console.log('status:', r.status);
  console.log('content-type:', r.headers.get('content-type'));
  const reader = r.body?.getReader();
  if (!reader) {
    console.log('no body');
    return;
  }

  const decoder = new TextDecoder();
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
    if (out.length > 2000) break;
  }
  console.log(out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

