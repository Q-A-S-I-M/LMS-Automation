// No need for node-fetch in Node 22
const BASE_URL = 'http://localhost:7000';
let cookie = '';

async function runTests() {
  console.log('--- TEST 1: Create Session ---');
  const sessionRes = await fetch(`${BASE_URL}/v1/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'S001', role: 'student', isAuthenticated: true })
  });
  const sessionData = await sessionRes.json();
  console.log('Session Response:', sessionData);
  
  const setCookie = sessionRes.headers.get('set-cookie');
  if (setCookie) {
    cookie = setCookie.split(';')[0];
    console.log('Cookie obtained:', cookie);
  } else {
    console.error('No cookie received!');
    return;
  }

  const testCases = [
    { name: 'Show my marks', message: 'show my marks' },
    { name: 'Show marks with params', message: 'show my marks for Spring-2026 and course CS101' },
    { name: 'Enroll in course', message: 'enroll in course' },
    { name: 'Invalid intent', message: 'what is the weather?' }
  ];

  for (const test of testCases) {
    console.log(`\n--- TEST: ${test.name} ---`);
    const chatRes = await fetch(`${BASE_URL}/v1/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({ message: test.message })
    });
    const chatData = await chatRes.json();
    console.log('Chat Response:', JSON.stringify(chatData, null, 2));
  }
}

runTests().catch(console.error);
