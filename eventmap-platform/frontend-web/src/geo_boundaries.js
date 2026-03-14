export const SEOUL_BOUNDARY = {
  "type": "Feature",
  "properties": { "name": "서울" },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [126.919, 37.689], [127.022, 37.696], [127.112, 37.632], [127.185, 37.581],
      [127.156, 37.512], [127.115, 37.428], [127.016, 37.442], [126.940, 37.425],
      [126.832, 37.433], [126.764, 37.512], [126.815, 37.604], [126.919, 37.689]
    ]]
  }
};

export const GYEONGGI_BOUNDARY = {
  "type": "Feature",
  "properties": { "name": "경기도" },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [126.7, 38.1], [127.1, 38.2], [127.6, 37.9], [127.7, 37.5], [127.4, 37.0],
      [126.8, 36.9], [126.6, 37.2], [126.5, 37.6], [126.7, 38.1]
    ]]
  }
};

export const GANGWON_BOUNDARY = {
  "type": "Feature",
  "properties": { "name": "강원도" },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [127.7, 38.3], [128.5, 38.6], [129.3, 37.6], [129.2, 37.2], [128.5, 37.1],
      [127.8, 37.3], [127.7, 38.3]
    ]]
  }
};

export const CHUNGNAM_BOUNDARY = {
  "type": "Feature",
  "properties": { "name": "충남" },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [126.5, 37.0], [127.3, 36.9], [127.5, 36.2], [126.8, 36.0], [126.1, 36.5], [126.5, 37.0]
    ]]
  }
};

export const CHUNGBUK_BOUNDARY = {
  "type": "Feature",
  "properties": { "name": "충북" },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [127.3, 37.2], [128.1, 37.1], [128.4, 36.5], [127.6, 36.1], [127.1, 36.5], [127.3, 37.2]
    ]]
  }
};

export const BUSAN_BOUNDARY = {
  "type": "Feature",
  "properties": { "name": "부산" },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [129.006, 35.241], [129.141, 35.248], [129.231, 35.195], [129.176, 35.064],
      [129.043, 35.035], [128.908, 35.059], [128.841, 35.152], [129.006, 35.241]
    ]]
  }
};

export const JEJU_BOUNDARY = {
  "type": "Feature",
  "properties": { "name": "제주도" },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [126.237, 33.355], [126.541, 33.561], [126.871, 33.528], [126.963, 33.432],
      [126.843, 33.224], [126.565, 33.208], [126.223, 33.265], [126.237, 33.355]
    ]]
  }
};

export const REGION_BOUNDARIES = {
  "서울": SEOUL_BOUNDARY,
  "경기도": GYEONGGI_BOUNDARY,
  "강원도": GANGWON_BOUNDARY,
  "충남": CHUNGNAM_BOUNDARY,
  "충북": CHUNGBUK_BOUNDARY,
  "부산": BUSAN_BOUNDARY,
  "제주도": JEJU_BOUNDARY
};
