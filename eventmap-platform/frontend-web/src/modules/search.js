import { state, REGION_COORDS, eventStore } from './state.js';
import { showToast } from './ui.js';

/**
 * 🔍 Search & Filtering Engine
 */

export function getTokens(str) {
  const s = str.replace(/\s+/g, '').toLowerCase();
  const tokens = [];
  for (let i = 0; i < s.length - 1; i++) tokens.push(s.substring(i, i + 2));
  return tokens;
}

export function filterMarkers() {
  const q = state.searchQuery.toLowerCase();
  const isTagSearch = q.startsWith("@");
  const cleanQ = isTagSearch ? q.substring(1) : q;
  const qTokens = cleanQ.length >= 2 ? getTokens(cleanQ) : [];

  const toAdd = [];
  const toRemove = [];

  state.markers.forEach(({ marker, data }) => {
    // 1. Search Query Match
    let mS = false;
    if (isTagSearch) {
      mS = data.tags.some(t => t.toLowerCase().includes(cleanQ));
    } else {
      const title = data.title.toLowerCase();
      const hasExact = title.includes(q) || data.tags.some(t => t.toLowerCase().includes(q));
      let hasFuzzy = false;
      if (!hasExact && qTokens.length > 0) {
        const titleTokens = getTokens(title);
        hasFuzzy = qTokens.some(qt => titleTokens.includes(qt));
      }
      mS = hasExact || hasFuzzy;
    }

    // 2. Country Match
    const mC = (state.currentCountry === "Memo") || (data.country === state.currentCountry);

    // 3. Sub-Filter Match
    let mSub = state.currentSubFilter === "전체";
    if (!mSub) {
      if (state.currentSubFilter.startsWith("@")) {
        mSub = data.tags.some(t => t === state.currentSubFilter);
      } else {
        mSub = data.region === state.currentSubFilter;
      }
    }

    // 4. Marker Type Filter (Tourist vs Memory)
    // 🔑 data.type is the authoritative source (set in utils.js createEventObject)
    // Fallback to id-prefix for legacy items loaded from IndexedDB before this fix
    const dataType = data.type || (() => {
        const idStr = String(data.id || '');
        if (idStr.startsWith('s-db-')) return 'tourist';
        if (idStr.startsWith('kuzmo-')) return 'memory';
        return 'unknown'; // Legacy/unclassified → always shown
    })();
    
    let mType = true;
    if (dataType === 'tourist' && !state.showTourist) mType = false;
    if (dataType === 'memory'  && !state.showMemory)  mType = false;
    // 'unknown' type legacy items are always visible (mType stays true)

    const visible = mS && mC && mSub && mType;
    if (visible) {
        if (!state.clusterGroup.hasLayer(marker)) toAdd.push(marker);
    } else {
        if (state.clusterGroup.hasLayer(marker)) toRemove.push(marker);
    }
  });

  if (toAdd.length > 0) state.clusterGroup.addLayers(toAdd);
  if (toRemove.length > 0) state.clusterGroup.removeLayers(toRemove);
}

export function flyToFilteredResults() {
  const visibleMarkers = [];
  state.markers.forEach(({ marker }) => {
    if (state.clusterGroup.hasLayer(marker)) {
      visibleMarkers.push(marker.getLatLng());
    }
  });

  if (visibleMarkers.length > 0) {
    const bounds = L.latLngBounds(visibleMarkers);
    if (visibleMarkers.length === 1) {
      state.map.flyTo(visibleMarkers[0], 13, { duration: 1.5 });
    } else {
      state.map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 14, duration: 1.5 });
    }
  } else {
    const qRaw = state.searchQuery.replace(/[@#]/g, " ");
    const words = qRaw.split(/\s+/);
    for (const word of words) {
      if (word && REGION_COORDS[word]) {
        state.map.flyTo(REGION_COORDS[word], 10, { duration: 1.5 });
        break;
      }
    }
  }
}
