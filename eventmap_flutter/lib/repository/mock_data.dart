import '../models/event_item.dart';
import 'dart:math';

final List<EventItem> mockEvents = [
  // --- CORE KOREA ---
  EventItem(id: 1, title: "경복궁", lat: 37.5796, lng: 126.9770, country: "Korea", region: "서울", tags: ["@역사", "@고궁", "@명소"], theme: "문화", imageUrl: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?q=80&w=600"),
  EventItem(id: 2, title: "남산서울타워", lat: 37.5511, lng: 126.9882, country: "Korea", region: "서울", tags: ["@랜드마크", "@야경", "@명소"], theme: "관광", imageUrl: "https://images.unsplash.com/photo-1538485399081-7191377e8241?q=80&w=600"),
  EventItem(id: 3, title: "롯데월드타워", lat: 37.5126, lng: 127.1025, country: "Korea", region: "서울", tags: ["@쇼핑", "@전망대", "@명소"], theme: "관광", imageUrl: "https://images.unsplash.com/photo-1531572751522-aa77232230da?q=80&w=600"),
  EventItem(id: 4, title: "DDP", lat: 37.5668, lng: 127.0094, country: "Korea", region: "서울", tags: ["@건축", "@전시", "@명소"], theme: "문화", imageUrl: "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?q=80&w=600"),
  EventItem(id: 50, title: "해운대 해수욕장", lat: 35.1587, lng: 129.1604, country: "Korea", region: "부산", tags: ["@바다", "@축제", "@명소"], theme: "관광", imageUrl: "https://images.unsplash.com/photo-1590603740183-980e7f6920eb?q=80&w=600"),
  EventItem(id: 80, title: "성산일출봉", lat: 33.4581, lng: 126.9426, country: "Korea", region: "제주", tags: ["@자연", "@유네스코", "@명소"], theme: "관광", imageUrl: "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=600"),
  
  // --- CORE JAPAN ---
  EventItem(id: 101, title: "도쿄 스카이트리", lat: 35.7101, lng: 139.8107, country: "Japan", region: "도쿄", tags: ["@타워", "@야경", "@명소"], theme: "관광", imageUrl: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=600"),
  EventItem(id: 151, title: "오사카성", lat: 34.6873, lng: 135.5262, country: "Japan", region: "오사카", tags: ["@성", "@역사", "@명소"], theme: "박물관", imageUrl: "https://images.unsplash.com/photo-1590227195057-690184286196?q=80&w=600"),
  EventItem(id: 180, title: "기요미즈데라", lat: 34.9949, lng: 135.7850, country: "Japan", region: "교토", tags: ["@사찰", "@유네스코", "@명소"], theme: "전통", imageUrl: "https://images.unsplash.com/photo-1493902342805-5da309e5b62b?q=80&w=600"),

  // --- DENSITY GENERATION (The "쏟아 넣어라" part) ---
  ...List.generate(60, (i) => EventItem(
    id: 1000 + i,
    title: "서울 관광지 #${i + 1}",
    lat: 37.5 + (Random().nextDouble() * 0.2),
    lng: 126.9 + (Random().nextDouble() * 0.2),
    country: "Korea", region: "서울",
    tags: ["@역사", "@탐방"],
    imageUrl: "https://picsum.photos/seed/${i+100}/400/300",
  )),

  ...List.generate(60, (i) => EventItem(
    id: 2000 + i,
    title: "도쿄 관광지 #${i + 1}",
    lat: 35.6 + (Random().nextDouble() * 0.3),
    lng: 139.6 + (Random().nextDouble() * 0.3),
    country: "Japan", region: "도쿄",
    tags: ["@쇼핑", "@기록"],
    imageUrl: "https://picsum.photos/seed/${i+200}/400/300",
  )),
];
