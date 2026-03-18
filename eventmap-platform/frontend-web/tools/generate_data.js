const regions = {
  "Korea": [
    { name: "서울", lat: 37.5665, lng: 126.9780 },
    { name: "부산", lat: 35.1796, lng: 129.0756 },
    { name: "제주도", lat: 33.4996, lng: 126.5312 },
    { name: "경기도", lat: 37.4138, lng: 127.5183 },
    { name: "강원도", lat: 37.8228, lng: 128.1555 },
    { name: "충남", lat: 36.6588, lng: 126.6728 },
    { name: "충북", lat: 36.6353, lng: 127.4913 }
  ],
  "Japan": [
    { name: "도쿄", lat: 35.6762, lng: 139.6503 },
    { name: "오사카", lat: 34.6937, lng: 135.5023 },
    { name: "후쿠오카", lat: 33.5902, lng: 130.4017 },
    { name: "나고야", lat: 35.1815, lng: 136.9066 },
    { name: "훗카이도", lat: 43.0641, lng: 141.3469 },
    { name: "오키나와", lat: 26.2124, lng: 127.6809 }
  ]
};

const tags = ["축제", "맛집", "카페", "쇼핑", "역사", "자연", "야경", "데이트", "랜드마크", "로컬"];
const images = [
  "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8",
  "https://images.unsplash.com/photo-1538485399081-7191377e8241",
  "https://images.unsplash.com/photo-1531572751522-aa77232230da",
  "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf",
  "https://images.unsplash.com/photo-1610448708562-9752fcb5a6bb",
  "https://images.unsplash.com/photo-1535185384736-27d04f107353",
  "https://images.unsplash.com/photo-1517154421773-0529f29ea451",
  "https://images.unsplash.com/photo-1538668383454-15c07b9df6bc",
  "https://images.unsplash.com/photo-1590603740183-980e7f6920eb",
  "https://images.unsplash.com/photo-1578308818056-14309559fc43"
];

let events = [];
let id = 1;

// Generate Korea Points (300+)
for (let i = 0; i < 350; i++) {
  const reg = regions.Korea[Math.floor(Math.random() * regions.Korea.length)];
  events.push({
    id: id++,
    title: `${reg.name} 명소 ${i % 20 + 1}`,
    lat: reg.lat + (Math.random() - 0.5) * 0.4,
    lng: reg.lng + (Math.random() - 0.5) * 0.4,
    country: "Korea",
    region: reg.name,
    tags: [tags[Math.floor(Math.random() * tags.length)], tags[Math.floor(Math.random() * tags.length)]],
    imageUrl: images[Math.floor(Math.random() * images.length)] + "?q=80&w=600"
  });
}

// Generate Japan Points (100+)
for (let i = 0; i < 150; i++) {
  const reg = regions.Japan[Math.floor(Math.random() * regions.Japan.length)];
  events.push({
    id: id++,
    title: `${reg.name} Spot ${i % 20 + 1}`,
    lat: reg.lat + (Math.random() - 0.5) * 0.5,
    lng: reg.lng + (Math.random() - 0.5) * 0.5,
    country: "Japan",
    region: reg.name,
    tags: [tags[Math.floor(Math.random() * tags.length)], tags[Math.floor(Math.random() * tags.length)]],
    imageUrl: images[Math.floor(Math.random() * images.length)] + "?q=80&w=600"
  });
}

const fs = require('fs');
fs.writeFileSync('c:/YOON/CSrepos/NewEventMap/eventmap-platform/frontend-web/src/mock_data.js', `export const mockEvents = ${JSON.stringify(events, null, 2)};`);
console.log("Generated " + events.length + " markers.");
