import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testAnswer() {
  // Login
  const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: 'zayn1234' }),
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Login status:', loginRes.status);

  // Create session
  const sessRes = await fetch('http://localhost:3000/api/v1/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie || '',
    },
    body: JSON.stringify({
      topicId: 'auth-email-password',
      level: 'working',
      sessionMode: 'standard',
    }),
  });
  const sessData = await sessRes.json();
  const sessionId = sessData.session?.id;
  console.log('Session created ID:', sessionId);

  // Submit answer
  console.log('Submitting answer to session...');
  const ansRes = await fetch(`http://localhost:3000/api/v1/sessions/${sessionId}/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Cookie: cookie || '',
    },
    body: JSON.stringify({
      answer: 'We use Argon2id with 19 MiB memory, 2 iterations, and 16-byte random salt.',
      modality: 'text',
    }),
  });

  console.log('Answer response status:', ansRes.status);
  const reader = ansRes.body?.getReader();
  if (!reader) {
    console.log('No reader');
    return;
  }
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log('[SSE Chunk]:', decoder.decode(value));
  }
}

testAnswer().catch(console.error);
