const fs = require('fs');
const data = JSON.parse(fs.readFileSync('c:/YOON/CSrepos/NewEventMap/label_results.json', 'utf8'));
console.log('| Title | Region | Tags |');
console.log('|-------|--------|------|');
data.slice(0, 15).forEach(item => {
    console.log(`| ${item.title} | ${item.region} | ${item.tags.join(', ')} |`);
});
console.log('| ... | ... | ... |');
data.slice(-15).forEach(item => {
    console.log(`| ${item.title} | ${item.region} | ${item.tags.join(', ')} |`);
});
