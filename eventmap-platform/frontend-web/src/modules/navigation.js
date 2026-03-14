import { state, REGION_COORDS } from './state.js';
import { renderSubTabs, showRegionGlow } from './ui.js';
import { filterMarkers, flyToFilteredResults } from './search.js';
import { resetAllInteractions } from './handlers.js';

/**
 * 🧭 View Navigation Logic
 */

export function switchCountry(c, i) {
  resetAllInteractions();
  state.currentCountry = c;
  
  const tabs = document.querySelectorAll('.country-tab');
  tabs.forEach(t => t.classList.remove('active'));
  if (tabs[i]) tabs[i].classList.add('active');
  
  const indicator = document.getElementById('tab-indicator');
  if (indicator) indicator.style.transform = `translateX(${i * 110}px)`;
  
  renderSubTabs();
  filterMarkers();
}

export function setSubFilter(f) {
  state.currentSubFilter = f;
  if (REGION_COORDS[f]) {
    state.map.flyTo(REGION_COORDS[f], f === '전체' ? 7 : 10, { duration: 1.5 });
    showRegionGlow(f);
  }
  renderSubTabs();
  filterMarkers();
}

export function filterByTag(tag) {
  state.searchQuery = tag;
  const input = document.getElementById('search-input');
  if (input) input.value = tag;
  filterMarkers();
  flyToFilteredResults();
  document.getElementById('detail-sheet').classList.remove('active');
}
