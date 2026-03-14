const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:9091/');

ws.on('open', function open() {
  console.log('✅ Connected to C# Server');
  
  // 📡 Trigger Knowledge Fill
  console.log('📡 Sending KNOWLEDGE_FILL request...');
  ws.send(JSON.stringify({ type: 'KNOWLEDGE_FILL' }));
});

ws.on('message', function message(data) {
  const msg = JSON.parse(data);
  console.log(`📩 Received: [${msg.type}] ${msg.status || ''}`);
  
  if (msg.type === 'KNOWLEDGE_RESULT') {
    console.log(`📍 Received ${msg.data.length} Tourism Items`);
    // After receiving some data, we can stop if we want, or keep watching
  }
});

ws.on('error', function error(err) {
  console.error('❌ Socket Error:', err.message);
});

// Timeout after 30 seconds for testing
setTimeout(() => {
  console.log('🏁 Test finished. Closing connection.');
  ws.close();
  process.exit(0);
}, 15000);
