const fs = require('fs');
try {
    const rawData = fs.readFileSync('c:/YOON/CSrepos/NewEventMap/MonitoringBridge/CSharpServer/global_knowledge_cache.json', 'utf8');
    // Strip BOM if present
    const cleanData = rawData.replace(/^\uFEFF/, '');
    const data = JSON.parse(cleanData);
    Object.keys(data).forEach(k => {
        console.log(`${k}: ${data[k].length}`);
    });
} catch (e) {
    console.error('Error parsing JSON:', e.message);
}
