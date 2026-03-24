(() => {
  const upload = document.getElementById('uploadInput');
  const resetButton = document.getElementById('resetButton');
  const previewImg = document.getElementById('previewImg');
  const imageContainer = document.getElementById('imageContainer');
  const sampleCanvas = document.getElementById('sampleCanvas');
  const prefixInput = document.getElementById('prefixInput');
  const suffixInput = document.getElementById('suffixInput');
  const varTypeButtons = Array.from(document.querySelectorAll('.var-type-btn'));
  const colorTableBody = document.querySelector('#colorTable tbody');
  const codeBox = document.getElementById('codeBox');
  const copyBtn = document.getElementById('copyBtn');
  const addCurrentBtn = document.getElementById('addCurrentBtn');
  const pickedValue = document.getElementById('pickedValue');
  const fmtButtons = Array.from(document.querySelectorAll('.format-btn'));

  let currentPick = null;
  let dragging = false;
  let draggingMarker = null;
  let currentFormat = 'rgb';
  let currentVarType = 'css';
  let colorItems = [];

  const clamp = (v,mn,mx)=> Math.min(mx,Math.max(mn,v));
  const toHex = v => v.toString(16).padStart(2,'0');

  function toNaturalPoint(clientX, clientY) {
    const imgRect = previewImg.getBoundingClientRect();
    if (!previewImg.src || previewImg.classList.contains('hidden')) return null;
    if (clientX < imgRect.left || clientX > imgRect.right || clientY < imgRect.top || clientY > imgRect.bottom) return null;
    const px = clamp(Math.round(clientX - imgRect.left), 0, imgRect.width);
    const py = clamp(Math.round(clientY - imgRect.top), 0, imgRect.height);
    const ix = clamp(Math.floor(px * previewImg.naturalWidth / imgRect.width), 0, previewImg.naturalWidth - 1);
    const iy = clamp(Math.floor(py * previewImg.naturalHeight / imgRect.height), 0, previewImg.naturalHeight - 1);
    return { px, py, ix, iy };
  }

  function getImageMetrics() {
    const imgRect = previewImg.getBoundingClientRect();
    const containerRect = imageContainer.getBoundingClientRect();
    const offsetX = imgRect.left - containerRect.left;
    const offsetY = imgRect.top - containerRect.top;
    return { imgRect, containerRect, offsetX, offsetY };
  }

  function positionFromIndex(ix, iy) {
    const nW = previewImg.naturalWidth || 1;
    const nH = previewImg.naturalHeight || 1;
    return positionFromFraction(ix / nW, iy / nH);
  }

  function positionFromFraction(fx, fy) {
    const { imgRect, offsetX, offsetY } = getImageMetrics();
    if (!imgRect.width || !imgRect.height) return { left: 0, top: 0 };
    const left = offsetX + fx * imgRect.width;
    const top = offsetY + fy * imgRect.height;
    return { left, top };
  }

  function updateMarkerPosition(item) {
    if (!item.marker) return;
    const p = positionFromIndex(item.ix, item.iy);
    item.marker.style.left = `${Math.round(p.left)}px`;
    item.marker.style.top = `${Math.round(p.top)}px`;
  }

  function sampleColor(ix, iy) {
    const ctx = sampleCanvas.getContext('2d');
    sampleCanvas.width = 1;
    sampleCanvas.height = 1;
    ctx.drawImage(previewImg, ix, iy, 1, 1, 0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a };
  }

  function createMarker(item) {
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.style.backgroundColor = formatColor(item.raw);
    imageContainer.appendChild(marker);

    if (typeof item.px === 'number' && typeof item.py === 'number') {
      const { offsetX, offsetY } = getImageMetrics();
      marker.style.left = `${Math.round(offsetX + item.px)}px`;
      marker.style.top = `${Math.round(offsetY + item.py)}px`;
    }

    requestAnimationFrame(() => updateMarkerPosition(item));

    marker.addEventListener('pointerdown', event => {
      event.stopPropagation();
      event.preventDefault();
      draggingMarker = item;
      marker.setPointerCapture(event.pointerId);
      marker.classList.add('dragging');
    });

    item.marker = marker;
    return marker;
  }

  function updateItemUI(item) {
    const value = item.isManual ? item.rgbInput.value : formatColor(item.raw);
    item.rgbInput.value = value;
    item.swatch.style.backgroundColor = item.isManual ? item.rgbInput.value : formatColor(item.raw);
    item.marker.style.backgroundColor = item.isManual ? item.rgbInput.value : formatColor(item.raw);
  }

  function moveMarker(clientX, clientY) {
    if (!draggingMarker) return;
    const pos = toNaturalPoint(clientX, clientY);
    if (!pos) return;
    const { ix, iy } = pos;
    draggingMarker.ix = ix;
    draggingMarker.iy = iy;
    updateMarkerPosition(draggingMarker);

    if (!draggingMarker.isManual) {
      draggingMarker.raw = sampleColor(ix, iy);
      updateItemUI(draggingMarker);
      updateCodeOutput();
    }

    pickedValue.textContent = `Picked: ${draggingMarker.raw.r}, ${draggingMarker.raw.g}, ${draggingMarker.raw.b}`;
    pickedValue.style.color = `rgb(${draggingMarker.raw.r}, ${draggingMarker.raw.g}, ${draggingMarker.raw.b})`;
  }

  function addColor(r, g, b, a, ix, iy, px, py) {
    const id = colorItems.length + 1;
    const itemData = { id, raw: { r, g, b, a }, ix, iy, px, py, isManual: false };
    const row = makeRow(itemData);
    createMarker(itemData);
    colorTableBody.appendChild(row);
    colorItems.push(itemData);
    updateCodeOutput();
    pickedValue.textContent = `Picked: ${r}, ${g}, ${b}`;
    pickedValue.style.color = `rgb(${r}, ${g}, ${b})`;
    return itemData;
  }

  function addColorFromPoint(clientX, clientY) {
    const pos = toNaturalPoint(clientX, clientY);
    if (!pos) return;
    const raw = sampleColor(pos.ix, pos.iy);
    addColor(raw.r, raw.g, raw.b, raw.a, pos.ix, pos.iy, pos.px, pos.py);
  }

  function formatColor(c) {
    if (!c) return '';
    const {r,g,b} = c;
    const maxRGB = Math.max(r,g,b), minRGB = Math.min(r,g,b);
    const l = (maxRGB + minRGB) / 2;
    const d = maxRGB - minRGB;
    const s = l === 0 ? 0 : d / (1 - Math.abs(2*l/255 - 1));
    const hCalc = d === 0 ? 0 : (() => {
      if (maxRGB===r) return ((g - b)/d)%6;
      if (maxRGB===g) return ((b - r)/d)+2;
      return ((r - g)/d)+4;
    })();
    const hue = ((hCalc * 60) + 360) % 360;
    switch (currentFormat) {
      case 'hex': return '#' + toHex(r) + toHex(g) + toHex(b);
      case 'rgb': return `rgb(${r}, ${g}, ${b})`;
      case 'rgba': return `rgba(${r}, ${g}, ${b}, 1)`;
      case 'rgbSpace': return `rgb ${r} ${g} ${b}`;
      case 'values': return `${r}, ${g}, ${b}`;
      case 'hsl': return `hsl(${Math.round(hue)}, ${Math.round(s*100)}%, ${Math.round((l/255)*100)}%)`;
      default: return `rgb(${r}, ${g}, ${b})`;
    }
  }

  function updateCodeOutput() {
    const pre = prefixInput.value.trim();
    const suf = suffixInput.value.trim();
    const lines = colorItems.map(item => {
      const idx = item.numberInput.value.trim() || item.id;
      const value = item.rgbInput.value.trim() || formatColor(item.raw);
      const varName = currentVarType === 'scss'
        ? `$${pre}${idx}${suf}`
        : `--${pre}${idx}${suf}`;
      return `${varName}: ${value};`;
    });
    codeBox.textContent = lines.join('\n');
  }

  function makeRow(itemData) {
    const row = document.createElement('tr');
    const swatchTd = document.createElement('td');
    const numTd = document.createElement('td');
    const valTd = document.createElement('td');
    const rmTd = document.createElement('td');

    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.backgroundColor = formatColor(itemData.raw);
    swatchTd.appendChild(sw);

    itemData.swatch = sw;

    const numInput = document.createElement('input');
    numInput.className = 'underlined';
    numInput.type = 'text';
    numInput.value = itemData.id;
    numInput.addEventListener('input', updateCodeOutput);
    numTd.appendChild(numInput);

    const valInput = document.createElement('input');
    valInput.className = 'underlined';
    valInput.type = 'text';
    valInput.value = formatColor(itemData.raw);
    itemData.isManual = false;
    valInput.addEventListener('input', () => {
      itemData.isManual = true;
      sw.style.backgroundColor = valInput.value;
      updateCodeOutput();
    });
    valTd.appendChild(valInput);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn danger';
    removeBtn.textContent = 'Remove';
    removeBtn.classList.add('remove-btn');
    removeBtn.addEventListener('click', () => {
      colorItems = colorItems.filter(x => x !== itemData);
      if (itemData.marker) itemData.marker.remove();
      row.remove();
      updateCodeOutput();
    });
    rmTd.appendChild(removeBtn);

    row.append(swatchTd, numTd, valTd, rmTd);
    itemData.row = row;
    itemData.numberInput = numInput;
    itemData.rgbInput = valInput;
    return row;
  }

  function refreshRows() {
    colorItems.forEach(item => {
      if (!item.isManual) {
        item.rgbInput.value = formatColor(item.raw);
        item.swatch.style.backgroundColor = formatColor(item.raw);
      }
      if (item.marker) {
        item.marker.style.backgroundColor = formatColor(item.raw);
        updateMarkerPosition(item);
      }
    });
    updateCodeOutput();
  }

  function setPickerAt() { return; }

  function removeAllMarkers() {
    colorItems.forEach(item => { if (item.marker) item.marker.remove(); });
    colorItems = [];
    colorTableBody.innerHTML = '';
    updateCodeOutput();
  }

  upload.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    removeAllMarkers();
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    previewImg.classList.remove('hidden');
    previewImg.onload = () => {
      currentPick = null;
      pickedValue.textContent = 'Click image to add selector';
      pickedValue.style.color = 'inherit';
      refreshRows();
    };
  });

  resetButton.addEventListener('click', () => {
    upload.value = '';
    previewImg.src = '';
    previewImg.classList.add('hidden');
    currentPick = null;
    draggingMarker = null;
    removeAllMarkers();
    codeBox.textContent = '';
    pickedValue.textContent = 'No pick yet';
    pickedValue.style.color = 'inherit';
  });

  imageContainer.addEventListener('pointerdown', event => {
    if (previewImg.classList.contains('hidden')) return;
    if (event.target.classList.contains('marker')) return;
    event.preventDefault();
    dragging = true;
    addColorFromPoint(event.clientX, event.clientY);
  });

  window.addEventListener('pointermove', event => {
    if (!draggingMarker) return;
    moveMarker(event.clientX, event.clientY);
  });

  window.addEventListener('pointerup', () => {
    if (draggingMarker) {
      draggingMarker.marker.classList.remove('dragging');
      draggingMarker = null;
    }
    dragging = false;
  });

  window.addEventListener('resize', () => {
    refreshRows();
  });

  addCurrentBtn.style.display = 'none';

  prefixInput.addEventListener('input', updateCodeOutput);
  suffixInput.addEventListener('input', updateCodeOutput);

  fmtButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      fmtButtons.forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      currentFormat = btn.dataset.format;
      refreshRows();
    });
  });

  varTypeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      varTypeButtons.forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      currentVarType = btn.dataset.varType;
      updateCodeOutput();
    });
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(codeBox.textContent);
      const old = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = old; }, 1100);
    } catch (e) {
      alert('Copy failed. Please copy manually.');
    }
  });
})();