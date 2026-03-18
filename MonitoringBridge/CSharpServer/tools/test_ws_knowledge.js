const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9091/');

ws.on('open', function open() {
  console.log('✅ Connected to server');
  ws.send(JSON.stringify({ type: 'KNOWLEDGE_REQUEST' }));
});

ws.on('message', function incoming(data) {
  const msg = JSON.parse(data);
  if (msg.type === 'KNOWLEDGE_RESULT') {
    const total = msg.data ? msg.data.length : 0;
    console.log(`📊 Total items in server cache: ${total}`);
    
    const regions = {};
    msg.data.forEach(item => {
        const region = (item.Tags && item.Tags[0]) || 'Unknown';
        regions[region] = (regions[region] || 0) + 1;
    });
    
    console.log('📍 Region Breakdown:');
    Object.keys(regions).sort().forEach(r => {
        console.log(` - ${r}: ${regions[r]}`);
    });
    
    process.exit();
  }
});

setTimeout(() => {
    console.log('Timeout waiting for response');
    process.exit(1);
}, 10000);
