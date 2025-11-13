let map, geoJsonLayer, populationLayer;
let species = [];
let selectedSpecies = null;

const provinceMap = {
  "Благоевград": "Blagoevgrad", "Бургас": "Burgas", "Варна": "Varna", "Велико Търново": "Veliko Tarnovo",
  "Видин": "Vidin", "Враца": "Vratsa", "Габрово": "Gabrovo", "Кърджали": "Kardzhali", "Кюстендил": "Kyustendil",
  "Ловеч": "Lovech", "Монтана": "Montana", "Пазарджик": "Pazardzhik", "Перник": "Pernik", "Плевен": "Pleven",
  "Пловдив": "Plovdiv", "Разград": "Razgrad", "Русе": "Ruse", "Силистра": "Silistra", "Сливен": "Sliven",
  "Смолян": "Smolyan", "София": "Sofia", "Стара Загора": "Stara Zagora", "Добрич": "Dobrich",
  "Търговище": "Targovishte", "Хасково": "Haskovo", "Шумен": "Shumen", "Ямбол": "Yambol"
};

// --- Load species data ---
fetch('data/species.json')
  .then(r => r.json())
  .then(data => {
    species = data;
    initMap();
    initSearch();
    initProvinceWindow();
    initWindows();
    initRefreshButton();
  })
  .catch(console.error);

// --- Initialize map ---
function initMap() {
  map = L.map('map').setView([42.7, 25.3], 7);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  fetch('data/bulgaria-provinces.json').then(r => r.json()).then(geojson => {
    geoJsonLayer = L.geoJSON(geojson, {
      style: { color: '#777', weight: 1, fillColor: '#444', fillOpacity: 0.78 },
      onEachFeature: (feature, layer) => {
        const bgName = Object.keys(provinceMap).find(k => provinceMap[k] === feature.properties.NAME_1);
        layer.on('mouseover', () => layer.setStyle({ weight: 2, fillOpacity: 0.85, fillColor: '#555' }));
        layer.on('mouseout', () => layer.setStyle({ weight: 1, fillOpacity: 0.78, fillColor: '#444' }));
        layer.on('click', () => showProvincePopup(bgName, layer));
      }
    }).addTo(map);
  });
}

// --- Refresh Map Button ---
function initRefreshButton() {
  const btn = document.createElement('button');
  btn.id = 'refresh-map-btn';
  btn.textContent = 'Обнови карта';
  btn.style.position = 'absolute';
  btn.style.top = '15px';
  btn.style.right = '15px';
  btn.style.zIndex = '1200';
  btn.style.background = '#031158ff';
  btn.style.color = 'white';
  btn.style.border = 'none';
  btn.style.borderRadius = '8px';
  btn.style.padding = '8px 14px';
  btn.style.cursor = 'pointer';
  btn.style.fontWeight = '600';
  btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
  btn.style.transition = 'all 0.2s ease';
  btn.onmouseover = () => btn.style.background = '#145eb8ff';
  btn.onmouseout = () => btn.style.background = '#160ea5ff';
  btn.onclick = refreshMap;
  document.body.appendChild(btn);
}

// --- Refresh map logic ---
function refreshMap() {
  selectedSpecies = null;
  if (populationLayer) {
    map.removeLayer(populationLayer);
    populationLayer = null;
  }
  if (geoJsonLayer) {
    geoJsonLayer.eachLayer(layer => {
      geoJsonLayer.resetStyle(layer);
      layer.closePopup();
    });
  }
  // Close any popup manually opened
  map.closePopup();
}

// --- Show province popup ---
function showProvincePopup(bgName, layer = null) {
  let speciesList = [];

  // If a species is selected and has population in this province, only show it
  if (selectedSpecies && selectedSpecies.populations[bgName]) {
    speciesList = [selectedSpecies];
  } else {
    // Otherwise show all species in this province
    speciesList = species.filter(s => s.populations[bgName]);
  }

  if (!speciesList.length) return;

  // Build HTML
  let html = `<div style="font-weight:700; font-size:16px; margin-bottom:6px;">${bgName}</div>`;
  const statusColors = { CR: '#ff0044', EN: '#ff6600', VU: '#ffcc00', NT: '#00ffc2', LC: '#00ff66' };

  speciesList.forEach(s => {
    const pop = s.populations[bgName]?.total || 'Няма данни';
    html += `
      <div class="popup-species" style="padding:6px; margin-bottom:4px; border-radius:6px; background:rgba(15,23,42,0.8);">
        <div class="species-name" data-name="${s.name}" style="font-weight:700; color:#3b82f6; cursor:pointer;">${s.name}</div>
        <div>Категория: <span style="color:#3b82f6">${s.category}</span></div>
        <div>Статус: <span style="color:${statusColors[s.status] || '#888'}">${s.status}</span></div>
        <div>Популация: ${pop}</div>
        <div><button class="see-more-btn" style="margin-top:4px; background:#0ea5a3; color:white; border:none; padding:2px 6px; border-radius:6px; cursor:pointer;">Виж повече</button></div>
      </div>`;
  });

  const popupOptions = { className: 'custom-popup', minWidth: 220 };

  // Show popup exactly above province
  if (layer) {
    layer.bindPopup(html, popupOptions).openPopup();
  } else {
    // fallback: use center of province layer
    const provinceLayer = geoJsonLayer.getLayers().find(l => {
      return Object.keys(provinceMap).find(k => provinceMap[k] === l.feature.properties.NAME_1) === bgName;
    });
    if (provinceLayer) {
      provinceLayer.bindPopup(html, popupOptions).openPopup();
    } else {
      L.popup(popupOptions).setLatLng(geoJsonLayer.getBounds().getCenter()).setContent(html).openOn(map);
    }
  }

  // Event listeners
  setTimeout(() => {
    document.querySelectorAll('.species-name').forEach(el => {
      el.onclick = () => {
        const name = el.dataset.name;
        const sObj = species.find(s => s.name === name);
        if (sObj) showSpeciesOnMap(sObj, false);
      };
    });

    document.querySelectorAll('.see-more-btn').forEach(btn => {
      btn.onclick = () => {
        const name = btn.closest('.popup-species').querySelector('.species-name').dataset.name;
        const sObj = species.find(s => s.name === name);
        if (sObj) showSpeciesInfo(sObj);
      };
    });
  }, 50);
}


// --- Show species population only ---
function showSpeciesOnMap(s, showArticle = false) {
  selectedSpecies = s;
  if (populationLayer) map.removeLayer(populationLayer);

  fetch('data/bulgaria-provinces.json').then(r => r.json()).then(geojson => {
    populationLayer = L.geoJSON(geojson, {
      style: f => {
        const bgName = Object.keys(provinceMap).find(k => provinceMap[k] === f.properties.NAME_1);
        const popData = s.populations[bgName];
        return { color: '#aaa', weight: 1, fillColor: popData ? '#3b82f6' : '#444', fillOpacity: 0.9 };
      },
      onEachFeature: (feature, layer) => {
        const bgName = Object.keys(provinceMap).find(k => provinceMap[k] === feature.properties.NAME_1);
        if (s.populations[bgName]) {
          layer.on('click', () => showProvincePopup(bgName, layer));
          layer.on('mouseover', () => layer.setStyle({ weight: 2, fillColor: '#555' }));
          layer.on('mouseout', () => layer.setStyle({ weight: 1, fillColor: '#3b82f6' }));
        }
      }
    }).addTo(map);
  });
}

// --- Species info article ---
function showSpeciesInfo(s) {
  const win = document.getElementById('species-info');
  document.getElementById('species-title').textContent = s.name;
  document.getElementById('species-desc').textContent = s.description || 'Няма налична информация.';
  document.getElementById('species-img').src = s.image || 'https://via.placeholder.com/400x250?text=No+Image';
  win.style.display = 'flex';

  const minBtn = win.querySelector('.min-btn');
  minBtn.onclick = () => {
    win.style.display = 'none';
    const bottomToolbar = document.getElementById('bottom-toolbar');
    if (!Array.from(bottomToolbar.children).some(i => i.textContent === s.name)) {
      const icon = document.createElement('div');
      icon.className = 'toolbar-icon';
      icon.textContent = s.name;
      icon.onclick = () => {
        win.style.display = 'flex';
        icon.remove();
      };
      bottomToolbar.appendChild(icon);
    }
  };
  makeDraggable(win);
}

// --- Search ---
function initSearch() {
  const searchInput = document.getElementById('search-input');
  const suggestionBox = document.getElementById('suggestions');
  const filters = document.querySelectorAll('.filter-btn');

  filters.forEach(b => b.addEventListener('click', () => {
    b.classList.toggle('active');
    updateSuggestions();
  }));

  searchInput.addEventListener('input', updateSuggestions);

  function updateSuggestions() {
    const q = searchInput.value.trim().toLowerCase();
    const activeCats = Array.from(filters).filter(b => b.classList.contains('active')).map(b => b.dataset.value);
    let filtered = species;
    if (activeCats.length) filtered = filtered.filter(s => activeCats.includes(s.category));
    if (q) filtered = filtered.filter(s => s.name.toLowerCase().includes(q));
    suggestionBox.innerHTML = '';
    filtered.slice(0, 20).forEach(s => {
      const div = document.createElement('div');
      div.className = 'sugg';
      div.textContent = s.name;
      div.onclick = () => showSpeciesOnMap(s, false);
      suggestionBox.appendChild(div);
    });
  }

  document.getElementById('toggleFilters').onclick = () => {
    const f = document.getElementById('filters');
    f.style.display = f.style.display === 'block' ? 'none' : 'block';
  };
}

// --- Province window ---
function initProvinceWindow() {
  const win = document.getElementById('province-window');
  const btn = document.getElementById('province-btn');

  btn.onclick = () => {
    win.style.display = win.style.display === 'block' ? 'none' : 'block';
    if (win.style.display === 'none') return;

    win.innerHTML = '';
    Object.keys(provinceMap).forEach(bgName => {
      const count = species.filter(s => s.populations[bgName]).length;
      const div = document.createElement('div');
      div.className = 'province-item';
      div.textContent = `${bgName} (${count})`;
      div.onclick = () => {
        refreshMap();           // deselect currently selected species
        showProvincePopup(bgName);  // show the popup for this province
      };
      win.appendChild(div);
    });
  };
}



// --- Windows + Toolbar ---
function initWindows() {
  const windows = document.querySelectorAll('.window');
  const sideToolbar = document.getElementById('toolbar');

  windows.forEach(win => {
    const minBtn = win.querySelector('.min-btn');
    minBtn.onclick = () => {
      win.style.display = 'none';
      if (win.id === 'search-window' || win.id === 'devlog-window') {
        const icon = document.createElement('div');
        icon.className = 'toolbar-icon';
        icon.textContent = win.dataset.title.charAt(0);
        icon.title = win.dataset.title;
        icon.onclick = () => { win.style.display = 'block'; icon.remove(); };
        sideToolbar.appendChild(icon);
      }
    };
    if (win.id === 'search-window') makeDraggable(win);
  });
}

// --- Make draggable ---
function makeDraggable(win) {
  let isDragging = false, offsetX = 0, offsetY = 0;
  const header = win.querySelector('.window-header');
  header.onmousedown = e => {
    isDragging = true;
    offsetX = e.clientX - win.getBoundingClientRect().left;
    offsetY = e.clientY - win.getBoundingClientRect().top;
  };
  document.addEventListener('mouseup', () => isDragging = false);
  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    win.style.left = (e.clientX - offsetX) + 'px';
    win.style.top = (e.clientY - offsetY) + 'px';
  });
}
