import { useState, useRef, useEffect } from 'react';
import { Download, Upload, SwatchBook, RefreshCw, Layers, FolderDown } from 'lucide-react';

// --- Color Helpers ---

function rgbToOklab(r, g, b) {
  const toLinear = (c) => c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  const lR = toLinear(r / 255);
  const lG = toLinear(g / 255);
  const lB = toLinear(b / 255);

  const l = 0.4122214708 * lR + 0.5363325363 * lG + 0.0514459929 * lB;
  const m = 0.2119034982 * lR + 0.6806995451 * lG + 0.1073969566 * lB;
  const s = 0.0883024619 * lR + 0.2817188376 * lG + 0.6299787005 * lB;

  const l_ = Math.cbrt(Math.max(0, l));
  const m_ = Math.cbrt(Math.max(0, m));
  const s_ = Math.cbrt(Math.max(0, s));

  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720403 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757673 * s_
  };
}

function oklabDistance(lab1, lab2) {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + (da * da + db * db) * 8.0);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function getLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}


export default function RecolorEditor() {
  const [imageSrc, setImageSrc] = useState(null);
  const [imageName, setImageName] = useState('recolored_item');
  const [category, setCategory] = useState('items'); // items vs enemy
  const [tolerance, setTolerance] = useState(10); // 0 to 50

  // Pixels & Colors state
  const [originalPixels, setOriginalPixels] = useState(null); // { width, height, data }
  const [uniqueColors, setUniqueColors] = useState([]); // Array of Hex strings
  const [colorMap, setColorMap] = useState({}); // originalHex -> snappedHex
  const [simplifiedColors, setSimplifiedColors] = useState([]); // Unique colors after snapping

  // Custom Palettes state (Material Library)
  const [customPalettes, setCustomPalettes] = useState({}); // { name: [hex1, hex2...] }
  const [activeParts, setActiveParts] = useState({}); // { partName: [hex1, hex2...] } (Local to image)
  const [newPaletteName, setNewPaletteName] = useState('');
  const [selectedColors, setSelectedColors] = useState(new Set()); // Selected simplified colors

  // Palette assignments maps simplifiedHex -> activePartName
  const [colorAssignments, setColorAssignments] = useState({});

  // Materials Library
  const [materials, setMaterials] = useState({});
  const [activeMaterialSwaps, setActiveMaterialSwaps] = useState({}); // { activePartName: targetMaterialName/targetPaletteName }
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState(null);
  const [saveConfirmName, setSaveConfirmName] = useState(null);
  const [luminanceBias, setLuminanceBias] = useState(0); // -100 (darker) to 100 (lighter)
  const [editingPaletteName, setEditingPaletteName] = useState(null);
  const [paletteGroups, setPaletteGroups] = useState({}); // { [paletteName]: groupName }
  const [isCreatingGroupFor, setIsCreatingGroupFor] = useState(null);
  const [openComboboxPart, setOpenComboboxPart] = useState(null);
  const [comboboxSearch, setComboboxSearch] = useState({}); // { [partName]: searchQuery }
  const [viewportBg, setViewportBg] = useState('#171717'); // viewport background option

  // Color Pinning state
  const [pinnedColors, setPinnedColors] = useState(new Set());  // hex strings immune to snapping
  const [isPinMode, setIsPinMode] = useState(false);  // when true, swatch clicks pin/unpin

  const canvasRef = useRef(null);
  const canvas32Ref = useRef(null);
  const originalCanvasRef = useRef(null);
  const originalCanvas32Ref = useRef(null);
  const fileInputRef = useRef(null);

  const offscreenOriginalRef = useRef(null);
  const offscreenModifiedRef = useRef(null);

  if (!offscreenOriginalRef.current && typeof document !== 'undefined') {
    offscreenOriginalRef.current = document.createElement('canvas');
  }
  if (!offscreenModifiedRef.current && typeof document !== 'undefined') {
    offscreenModifiedRef.current = document.createElement('canvas');
  }

  const isDraggingRef = useRef(false);
  const dragModeRef = useRef(null);
  const isSwatchesDraggingRef = useRef(false);
  const swatchDragModeRef = useRef(null);

  // Global mouseup listener to reset dragging states
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDraggingRef.current = false;
      dragModeRef.current = null;
      isSwatchesDraggingRef.current = false;
      swatchDragModeRef.current = null;
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // Redraw Original Canvas
  useEffect(() => {
    if (!originalPixels || !originalCanvasRef.current) return;
    const canvas = originalCanvasRef.current;
    canvas.width = originalPixels.width;
    canvas.height = originalPixels.height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(originalPixels.width, originalPixels.height);
    for (let i = 0; i < originalPixels.data.length; i++) {
      imgData.data[i] = originalPixels.data[i];
    }
    ctx.putImageData(imgData, 0, 0);

    // Save to offscreen original
    const offscreen = offscreenOriginalRef.current;
    offscreen.width = originalPixels.width;
    offscreen.height = originalPixels.height;
    const oCtx = offscreen.getContext('2d');
    oCtx.putImageData(imgData, 0, 0);

    if (originalCanvas32Ref.current) {
      const canvas32 = originalCanvas32Ref.current;
      canvas32.width = originalPixels.width;
      canvas32.height = originalPixels.height;
      const ctx32 = canvas32.getContext('2d');
      ctx32.putImageData(imgData, 0, 0);
    }
  }, [originalPixels]);

  // Load materials & custom palettes on mount
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const res = await fetch('/data/palettes/materials_library.json');
        if (res.ok) {
          const data = await res.json();
          setMaterials(data.materials || {});
        } else {
          setMaterials({
            iron: ["#1d1d2b", "#2c3e50", "#7f8c8d", "#bdc3c7", "#ecf0f1", "#ffffff"],
            copper: ["#3d1912", "#704214", "#b87333", "#e39a71", "#fdd5c4"],
            gold: ["#3d2b00", "#664012", "#cca038", "#eecc5d", "#fcf1be"],
            oak: ["#2a1b0a", "#5d3a1a", "#8e5e3a", "#dfbb9d", "#f2e1d9"],
            red_liquid: ["#5c0000", "#922b21", "#c0392b", "#e74c3c", "#ff7675"],
            mithril: ["#0a1a2f", "#003366", "#0055ff", "#00aaff", "#bf00ff", "#ff00ff"]
          });
        }
      } catch (err) {
        console.warn("Failed to load materials library, using default ramps.", err);
      }
    };

    const fetchCustomPalettes = async () => {
      try {
        const res = await fetch('/api/custom-palettes');
        if (res.ok) {
          const data = await res.json();
          setCustomPalettes(data || {});
        }
      } catch (err) {
        console.warn("Failed to load custom palettes.", err);
      }
    };

    const fetchPaletteGroups = async () => {
      try {
        const res = await fetch('/api/palette-groups');
        if (res.ok) {
          const data = await res.json();
          setPaletteGroups(data || {});
        }
      } catch (err) {
        console.warn("Failed to load palette groups.", err);
      }
    };

    fetchMaterials();
    fetchCustomPalettes();
    fetchPaletteGroups();
  }, []);

  const savePalettes = async (updatedPalettes) => {
    try {
      await fetch('/api/custom-palettes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPalettes)
      });
    } catch (err) {
      console.error("Failed to save custom palettes to server:", err);
    }
  };

  const savePaletteGroups = async (updatedGroups) => {
    try {
      await fetch('/api/palette-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedGroups)
      });
    } catch (err) {
      console.error("Failed to save palette groups to server:", err);
    }
  };

  // Handle Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      loadImage(file);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      loadImage(file);
    }
  };

  const loadImage = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to read pixel data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);

        // Extract unique colors
        const colors = new Set();
        for (let i = 0; i < imgData.data.length; i += 4) {
          const r = imgData.data[i];
          const g = imgData.data[i + 1];
          const b = imgData.data[i + 2];
          const a = imgData.data[i + 3];

          if (a > 128) { // Only keep opaque pixels
            colors.add(rgbToHex(r, g, b));
          }
        }

        let detectedCategory = 'items';
        if (img.width === 64 || img.height === 64) {
          detectedCategory = 'enemy';
        } else if (img.width === 256 || img.height === 256 || img.width === 1024 || img.height === 1024) {
          detectedCategory = 'input256';
        } else if (file.name.toLowerCase().includes('enemy') || file.name.toLowerCase().includes('enemies') || file.name.toLowerCase().includes('64px')) {
          detectedCategory = 'enemy';
        }
        setCategory(detectedCategory);
        setPinnedColors(new Set());
        setIsPinMode(false);

        setImageName(file.name.replace(/\.[^/.]+$/, ""));
        setImageSrc(img);
        setOriginalPixels({
          width: img.width,
          height: img.height,
          data: imgData.data
        });
        setUniqueColors(Array.from(colors));
        setSelectedColors(new Set());
        setColorAssignments({});
        setActiveParts({});
        setActiveMaterialSwaps({});
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Perform Tolerance Snapping with Pinned Color support
  useEffect(() => {
    if (uniqueColors.length === 0) return;

    const labs = uniqueColors.map(hex => {
      const rgb = hexToRgb(hex);
      return { hex, lab: rgbToOklab(rgb.r, rgb.g, rgb.b) };
    });

    const mapped = {};
    const centroids = [];

    // Pre-seed pinned colors as immovable centroids
    for (const item of labs) {
      if (pinnedColors.has(item.hex)) {
        centroids.push(item);
        mapped[item.hex] = item.hex;
      }
    }

    // Cluster remaining (non-pinned) colors
    for (const item of labs) {
      if (pinnedColors.has(item.hex)) continue; // already a centroid

      let matchedCentroid = null;
      let minDistance = Infinity;

      for (const center of centroids) {
        const dist = oklabDistance(item.lab, center.lab);
        if (dist < minDistance && dist < tolerance / 100) {
          minDistance = dist;
          matchedCentroid = center;
        }
      }

      if (matchedCentroid) {
        mapped[item.hex] = matchedCentroid.hex;
      } else {
        centroids.push(item);
        mapped[item.hex] = item.hex;
      }
    }

    setColorMap(mapped);
    setSimplifiedColors(centroids.map(c => c.hex));
  }, [uniqueColors, tolerance, pinnedColors]);

  // Redraw / Render Canvas with Snapping & Palette Swapping
  useEffect(() => {
    if (!originalPixels || !imageSrc || !canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = originalPixels.width;
    canvas.height = originalPixels.height;
    const ctx = canvas.getContext('2d');
    const newImgData = ctx.createImageData(originalPixels.width, originalPixels.height);

    for (let i = 0; i < originalPixels.data.length; i += 4) {
      const r = originalPixels.data[i];
      const g = originalPixels.data[i + 1];
      const b = originalPixels.data[i + 2];
      const a = originalPixels.data[i + 3];

      if (a < 128) {
        newImgData.data[i] = 0;
        newImgData.data[i + 1] = 0;
        newImgData.data[i + 2] = 0;
        newImgData.data[i + 3] = 0;
        continue;
      }

      const originalHex = rgbToHex(r, g, b);
      let hex = colorMap[originalHex] || originalHex;

      // Check if this snapped color belongs to an assigned palette that is swapped
      const assignedPalette = colorAssignments[hex];
      if (assignedPalette && activeMaterialSwaps[assignedPalette]) {
        const swapTarget = activeMaterialSwaps[assignedPalette];

        // Source palette colors (from active image parts)
        const sourcePaletteColors = activeParts[assignedPalette] || [];
        // Target colors (either material library ramp or custom library palette)
        let targetColors = [];
        if (materials[swapTarget]) {
          targetColors = materials[swapTarget];
        } else if (customPalettes[swapTarget]) {
          targetColors = customPalettes[swapTarget];
        }

        if (sourcePaletteColors.length > 0 && targetColors.length > 0) {
          // Sort both by luminance
          const sortedSource = [...sourcePaletteColors].sort((a, b) => getLuminance(a) - getLuminance(b));
          const sortedTarget = [...targetColors].sort((a, b) => getLuminance(a) - getLuminance(b));

          // Find the rank of the current color in the source palette
          const srcIndex = sortedSource.indexOf(hex);
          if (srcIndex !== -1) {
            // Map index using ratio (automated stretch/squeeze)
            const ratio = srcIndex / (sortedSource.length - 1 || 1);

            // Apply exponential luminance bias curve
            const exponent = Math.pow(3, -luminanceBias / 100);
            const biasedRatio = Math.pow(ratio, exponent);

            const targetIndex = Math.min(sortedTarget.length - 1, Math.round(biasedRatio * (sortedTarget.length - 1)));
            hex = sortedTarget[targetIndex];
          }
        }
      }

      const finalRgb = hexToRgb(hex) || { r, g, b };
      newImgData.data[i] = finalRgb.r;
      newImgData.data[i + 1] = finalRgb.g;
      newImgData.data[i + 2] = finalRgb.b;
      newImgData.data[i + 3] = 255; // Force solid alpha for non-background pixels
    }

    ctx.putImageData(newImgData, 0, 0);

    // Save to offscreen modified
    const offscreen = offscreenModifiedRef.current;
    offscreen.width = originalPixels.width;
    offscreen.height = originalPixels.height;
    const oCtx = offscreen.getContext('2d');
    oCtx.putImageData(newImgData, 0, 0);

    if (canvas32Ref.current) {
      const canvas32 = canvas32Ref.current;
      canvas32.width = originalPixels.width;
      canvas32.height = originalPixels.height;
      const ctx32 = canvas32.getContext('2d');
      ctx32.putImageData(newImgData, 0, 0);
    }
  }, [originalPixels, colorMap, colorAssignments, activeMaterialSwaps, customPalettes, activeParts, luminanceBias]);

  // Handle canvas pinning in Pin Mode
  const handleCanvasPin = (clientX, clientY) => {
    if (!canvasRef.current || !originalPixels) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Scale coordinate to canvas logical resolution
    const x = Math.floor(((clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((clientY - rect.top) / rect.height) * canvas.height);

    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
      const idx = (y * canvas.width + x) * 4;
      const a = originalPixels.data[idx + 3];
      if (a > 128) {
        const r = originalPixels.data[idx];
        const g = originalPixels.data[idx + 1];
        const b = originalPixels.data[idx + 2];
        const originalHex = rgbToHex(r, g, b);

        setPinnedColors(prev => {
          const next = new Set(prev);
          if (next.has(originalHex)) {
            next.delete(originalHex);
          } else {
            next.add(originalHex);
          }
          return next;
        });
      }
    }
  };

  // Handle drag selection on canvas
  const handleCanvasSelection = (clientX, clientY, mode) => {
    if (!canvasRef.current || !originalPixels) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Scale coordinate to canvas logical resolution
    const x = Math.floor(((clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((clientY - rect.top) / rect.height) * canvas.height);

    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
      const ctx = canvas.getContext('2d');
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      if (pixel[3] > 128) {
        const clickedHex = rgbToHex(pixel[0], pixel[1], pixel[2]);

        setSelectedColors(prev => {
          const next = new Set(prev);
          if (mode === 'select') {
            next.add(clickedHex);
          } else if (mode === 'deselect') {
            next.delete(clickedHex);
          }
          return next;
        });
      }
    }
  };

  const handleCanvasMouseDown = (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    if (isPinMode) {
      e.preventDefault();
      handleCanvasPin(e.clientX, e.clientY);
      return;
    }
    isDraggingRef.current = true;
    const mode = e.button === 0 ? 'select' : 'deselect';
    dragModeRef.current = mode;
    handleCanvasSelection(e.clientX, e.clientY, mode);
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDraggingRef.current || !dragModeRef.current) return;
    handleCanvasSelection(e.clientX, e.clientY, dragModeRef.current);
  };

  const handleCanvasMouseUpOrLeave = () => {
    isDraggingRef.current = false;
    dragModeRef.current = null;
  };

  const handleZoom = (sourceCanvas, targetCanvas, offscreenTarget, clientX, clientY) => {
    if (category !== 'input256' || !originalPixels) return;

    const rect = sourceCanvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * sourceCanvas.width;
    const y = ((clientY - rect.top) / rect.height) * sourceCanvas.height;

    const ctx = targetCanvas.getContext('2d');
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

    const zoomSize = Math.max(32, Math.round(sourceCanvas.width * 0.18));
    const halfZoom = zoomSize / 2;

    let sx = x - halfZoom;
    let sy = y - halfZoom;

    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;

    ctx.drawImage(
      offscreenTarget,
      sx, sy, zoomSize, zoomSize,
      0, 0, targetCanvas.width, targetCanvas.height
    );
  };

  const resetZoom = (targetCanvas, offscreenTarget) => {
    if (category !== 'input256' || !originalPixels) return;
    const ctx = targetCanvas.getContext('2d');
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.drawImage(offscreenTarget, 0, 0);
  };

  // Swatch Drag Selectors
  const handleSwatchMouseDown = (hex) => {
    isSwatchesDraggingRef.current = true;
    const isSelected = selectedColors.has(hex);
    const mode = isSelected ? 'deselect' : 'select';
    swatchDragModeRef.current = mode;
    setSelectedColors(prev => {
      const next = new Set(prev);
      if (mode === 'select') {
        next.add(hex);
      } else {
        next.delete(hex);
      }
      return next;
    });
  };

  const handleSwatchMouseEnter = (hex) => {
    if (!isSwatchesDraggingRef.current || !swatchDragModeRef.current) return;
    const mode = swatchDragModeRef.current;
    setSelectedColors(prev => {
      const next = new Set(prev);
      if (mode === 'select') {
        next.add(hex);
      } else {
        next.delete(hex);
      }
      return next;
    });
  };

  // Create Active Part from Selection (Local)
  const createPalette = () => {
    if (!newPaletteName.trim() || selectedColors.size === 0) return;

    const partName = newPaletteName.trim();
    const colorsList = Array.from(selectedColors);

    setActiveParts(prev => ({
      ...prev,
      [partName]: colorsList
    }));

    // Assign colors to the active part
    setColorAssignments(prev => {
      const updated = { ...prev };
      for (const hex of colorsList) {
        updated[hex] = partName;
      }
      return updated;
    });

    setSelectedColors(new Set());
    setNewPaletteName('');
  };

  // Remove Active Part
  const deletePalette = (name) => {
    setActiveParts(prev => {
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });

    setColorAssignments(prev => {
      const updated = { ...prev };
      for (const [hex, partName] of Object.entries(updated)) {
        if (partName === name) {
          delete updated[hex];
        }
      }
      return updated;
    });

    setActiveMaterialSwaps(prev => {
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });
  };

  // Save an Active Part's colors to the persistent Material Library
  const savePartToLibrary = (partName) => {
    const colors = activeParts[partName];
    if (!colors || colors.length === 0) return;

    if (customPalettes[partName]) {
      // Collision! Set state to trigger inline confirmation warning
      setSaveConfirmName(partName);
    } else {
      // No collision, save directly
      const nextPalettes = {
        ...customPalettes,
        [partName]: colors
      };
      setCustomPalettes(nextPalettes);
      savePalettes(nextPalettes);
    }
  };

  // Merge active part's colors into an existing library palette
  const mergePartToLibrary = (partName) => {
    const colors = activeParts[partName];
    console.log("mergePartToLibrary: Active part colors:", colors);
    const existingColors = customPalettes[partName] || [];
    console.log("mergePartToLibrary: Existing library colors:", existingColors);
    const mergedColors = Array.from(new Set([...existingColors, ...colors]));
    console.log("mergePartToLibrary: Merged colors to save:", mergedColors);

    const nextPalettes = {
      ...customPalettes,
      [partName]: mergedColors
    };
    setCustomPalettes(nextPalettes);
    savePalettes(nextPalettes);
    setSaveConfirmName(null);
  };

  // Delete a palette from the persistent Material Library
  const deleteLibraryPalette = (name) => {
    console.log("deleteLibraryPalette called for:", name);
    if (!window.confirm(`Are you sure you want to delete "${name}" from your Material Library?`)) {
      console.log("deleteLibraryPalette cancelled by user");
      return;
    }
    const nextPalettes = { ...customPalettes };
    delete nextPalettes[name];
    console.log("Updated palettes state to save:", nextPalettes);
    setCustomPalettes(nextPalettes);
    savePalettes(nextPalettes);
  };

  // Add library palette to active sprite parts
  const addLibraryPaletteToActive = (name, colors) => {
    setActiveParts(prev => ({
      ...prev,
      [name]: colors
    }));

    // Auto-assign any matching colors on the currently loaded sprite to this active part
    setColorAssignments(prev => {
      const updated = { ...prev };
      for (const hex of colors) {
        if (simplifiedColors.includes(hex)) {
          updated[hex] = name;
        }
      }
      return updated;
    });
  };

  // Load a library palette into the workspace to inspect and edit its colors
  const startEditingPalette = (name, colors) => {
    setEditingPaletteName(name);
    setImageName(`palette_${name}`);

    // Create a dummy pixel buffer representing the colors as vertical stripes
    const blockWidth = 16;
    const blockHeight = 16;
    const width = colors.length * blockWidth;
    const height = blockHeight;

    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const colorIdx = Math.floor(x / blockWidth);
        const rgb = hexToRgb(colors[colorIdx]) || { r: 0, g: 0, b: 0 };
        const pixelIdx = (y * width + x) * 4;
        data[pixelIdx] = rgb.r;
        data[pixelIdx + 1] = rgb.g;
        data[pixelIdx + 2] = rgb.b;
        data[pixelIdx + 3] = 255;
      }
    }

    // Load states so workspace processes this palette
    setImageSrc(true); // set truthy value so it renders viewport
    setOriginalPixels({
      width,
      height,
      data
    });
    setUniqueColors(colors);
    setSelectedColors(new Set());
    setColorAssignments({});
    setActiveParts({});
    setActiveMaterialSwaps({});
    setTolerance(10);
  };

  const saveEditedPalette = () => {
    if (!editingPaletteName) return;
    const nextPalettes = {
      ...customPalettes,
      [editingPaletteName]: simplifiedColors
    };
    setCustomPalettes(nextPalettes);
    savePalettes(nextPalettes);
    alert(`Successfully updated "${editingPaletteName}" with simplified colors (${simplifiedColors.length} colors)!`);
    cancelEditingPalette();
  };

  const cancelEditingPalette = () => {
    setEditingPaletteName(null);
    setImageSrc(null);
    setOriginalPixels(null);
    setUniqueColors([]);
  };

  // Download directly in browser
  const downloadAsset = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `${imageName}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save the final asset to backend
  const exportAsset = async () => {
    if (!canvasRef.current) return;
    const base64Image = canvasRef.current.toDataURL('image/png');

    try {
      const res = await fetch('/api/save-recolored-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: imageName,
          category, // 'items' or 'enemy'
          base64Image
        })
      });

      const data = await res.json();
      if (res.ok) {
        const subpath = category === 'items' ? 'items/' : (category === 'enemy' ? 'enemies/' : `dataset/${category}/`);
        const parts = imageName.split('_');
        const folder = parts.length > 1 ? parts.slice(0, -1).join('/') + '/' : '';
        alert(`Successfully saved to: public/assets/${subpath}${folder}${imageName}.png`);
      } else {
        alert(`Error saving asset: ${data.error}`);
      }
    } catch (err) {
      alert(`Network error saving asset: ${err.message}`);
    }
  };

  // Category folders list
  const categoryOptions = [
    { value: 'items', label: 'Items (32px)' },
    { value: 'enemy', label: 'Enemies (64px)' },
    { value: 'input256', label: 'Backgrounds (256px)' }
  ];

  const displaySize = category === 'enemy' ? 64 : 32;

  // Group the palettes and sort by group name, then palette name alphabetically
  const sortedPaletteEntries = Object.entries(customPalettes)
    .filter(([name]) => name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort(([nameA], [nameB]) => {
      const groupA = paletteGroups[nameA] || '';
      const groupB = paletteGroups[nameB] || '';

      if (groupA && !groupB) return -1;
      if (!groupA && groupB) return 1;

      if (groupA !== groupB) {
        return groupA.localeCompare(groupB);
      }
      return nameA.localeCompare(nameB);
    });

  // Group sorted list
  const groupedPalettes = {};
  sortedPaletteEntries.forEach(([name, colors]) => {
    const grp = paletteGroups[name] || '(No Group)';
    if (!groupedPalettes[grp]) {
      groupedPalettes[grp] = [];
    }
    groupedPalettes[grp].push([name, colors]);
  });

  // Extract all unique group names (sorted alphabetically, excluding default)
  const uniqueGroups = Array.from(new Set(Object.values(paletteGroups)))
    .filter(g => g && g !== '(No Group)')
    .sort((a, b) => a.localeCompare(b));

  return (
    <div className="flex h-[calc(100vh-84px)] gap-4 overflow-hidden text-sm" style={{ color: 'var(--color-text-primary)' }}>
      {/* Left / Main Workspace */}
      <div className="flex-1 flex flex-col items-center justify-between p-4 rounded-xl border"
        style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>

        {/* Top: Image Drag and Drop Area */}
        {!imageSrc ? (
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
            className="flex-1 w-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer hover:bg-white/5 transition-all gap-3"
            style={{ borderColor: 'var(--color-border-muted)' }}
          >
            <Upload size={48} className="text-muted-foreground" />
            <p className="font-bold">Drag and drop your AI sprite here</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Supports JPG, JPEG, PNG</p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex-1 w-full flex flex-col items-center justify-center gap-8 overflow-auto relative p-4">
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/75 p-1.5 rounded-lg border border-white/10" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] uppercase font-bold text-gray-400 px-1">BG:</span>
              {[
                { name: 'Off-Black', value: '#171717' },
                { name: 'Off-White', value: '#f5f5f5' },
                { name: 'Cyan', value: '#00ffff' },
                { name: 'Magenta', value: '#ff00ff' },
                { name: 'Yellow', value: '#ffff00' }
              ].map(color => (
                <button
                  key={color.value}
                  onClick={() => setViewportBg(color.value)}
                  className={`w-4 h-4 rounded-full border cursor-pointer hover:scale-110 transition-all ${viewportBg === color.value ? 'border-white scale-110 ring-1 ring-indigo-500' : 'border-white/20'}`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>

            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Original</span>
                <canvas
                  ref={originalCanvasRef}
                  onMouseMove={(e) => {
                    handleZoom(originalCanvasRef.current, canvasRef.current, offscreenModifiedRef.current, e.clientX, e.clientY);
                  }}
                  onMouseLeave={() => {
                    resetZoom(canvasRef.current, offscreenModifiedRef.current);
                  }}
                  className="w-[512px] h-[512px] object-contain border rounded-lg image-render-pixelated shadow-lg"
                  style={{
                    borderColor: 'var(--color-border-subtle)',
                    imageRendering: 'pixelated',
                    width: '512px',
                    height: '512px',
                    backgroundColor: viewportBg
                  }}
                />
              </div>

              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">Modified</span>
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={(e) => {
                    handleCanvasMouseMove(e);
                    handleZoom(canvasRef.current, originalCanvasRef.current, offscreenOriginalRef.current, e.clientX, e.clientY);
                  }}
                  onMouseUp={handleCanvasMouseUpOrLeave}
                  onMouseLeave={(e) => {
                    handleCanvasMouseUpOrLeave(e);
                    resetZoom(originalCanvasRef.current, offscreenOriginalRef.current);
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-[512px] h-[512px] object-contain border cursor-crosshair rounded-lg image-render-pixelated shadow-lg"
                  style={{
                    borderColor: 'var(--color-border-subtle)',
                    imageRendering: 'pixelated',
                    width: '512px',
                    height: '512px',
                    backgroundColor: viewportBg
                  }}
                />
              </div>
            </div>

            {category !== 'input256' && (
              <div className="flex flex-col items-center gap-1.5 border-t pt-4 w-full" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">1:1 Game Scale (Original vs Modified)</span>
                <div className="flex items-center gap-0 border rounded-lg overflow-hidden shadow" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <canvas
                    ref={originalCanvas32Ref}
                    className="image-render-pixelated"
                    style={{
                      imageRendering: 'pixelated',
                      width: `${displaySize}px`,
                      height: `${displaySize}px`,
                      backgroundColor: viewportBg
                    }}
                    title={`Original (${displaySize}px)`}
                  />
                  <div className="w-[1px] bg-neutral-800" style={{ height: `${displaySize}px` }} />
                  <canvas
                    ref={canvas32Ref}
                    className="image-render-pixelated"
                    style={{
                      imageRendering: 'pixelated',
                      width: `${displaySize}px`,
                      height: `${displaySize}px`,
                      backgroundColor: viewportBg
                    }}
                    title={`Modified (${displaySize}px)`}
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => setImageSrc(null)}
              className="absolute top-4 right-4 p-2 bg-black/75 hover:bg-black text-white rounded-lg text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={14} /> Clear Image
            </button>
          </div>
        )}

        {/* Bottom controls: Sliders and metadata */}
        {imageSrc && (
          <div className="w-full border-t pt-4 flex flex-col gap-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 flex items-center gap-4">
                  <label className="text-xs font-bold whitespace-nowrap">Color Merging Tolerance:</label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="flex-1 accent-indigo-500 h-1 bg-gray-700 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold w-8">{tolerance}</span>
                </div>
                <div className="text-xs font-bold shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                  Colors: <span className="font-mono text-white">{simplifiedColors.length}</span>{pinnedColors.size > 0 && <span className="text-amber-400 ml-1">({pinnedColors.size} pinned)</span>} (original: {uniqueColors.length})
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="text-xs font-bold whitespace-nowrap">Luminance Mapping Bias:</label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={luminanceBias}
                  onChange={(e) => setLuminanceBias(Number(e.target.value))}
                  className="flex-1 accent-indigo-500 h-1 bg-gray-700 rounded-lg cursor-pointer"
                />
                <span className="text-xs font-mono font-bold w-28 text-right">
                  {luminanceBias > 0 ? `+${luminanceBias}` : luminanceBias}%
                  <span className="text-[10px] opacity-70 ml-1">
                    ({luminanceBias === 0 ? 'Neutral' : (luminanceBias < 0 ? 'Darker' : 'Lighter')})
                  </span>
                </span>
              </div>
            </div>

            {/* Export / Palette Edit Bar */}
            {editingPaletteName ? (
              <div className="flex items-center justify-between gap-3 pt-2 border border-amber-500/30 bg-amber-500/10 p-3 rounded-lg w-full">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider">Editing Palette: {editingPaletteName}</span>
                  <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    Adjust Color Merging Tolerance above to merge duplicate/similar colors.
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={cancelEditingPalette}
                    className="px-4 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-bold text-xs transition-all shadow cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEditedPalette}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs transition-all shadow cursor-pointer"
                  >
                    Save Changes ({simplifiedColors.length} colors)
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={imageName}
                    onChange={(e) => setImageName(e.target.value)}
                    placeholder="Output file name"
                    className="px-3 py-1.5 rounded-lg border text-xs outline-none bg-black/20 focus:border-indigo-500 transition-all"
                    style={{ borderColor: 'var(--color-border-subtle)' }}
                  />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border text-xs bg-black/20 focus:border-indigo-500 outline-none"
                    style={{ borderColor: 'var(--color-border-subtle)' }}
                  >
                    {categoryOptions.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-neutral-900">{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={downloadAsset}
                    className="px-4 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow"
                  >
                    <Download size={14} /> Download PNG
                  </button>
                  <button
                    onClick={exportAsset}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow"
                  >
                    <FolderDown size={14} /> Export Variant
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Sidebar: Palettes & Ramps */}
      <div className="w-80 flex flex-col gap-4 overflow-y-auto p-4 rounded-xl border h-full"
        style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>

        {/* Create Palette section */}
        {imageSrc && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Create Custom Palette
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPaletteName}
                onChange={(e) => setNewPaletteName(e.target.value)}
                placeholder="e.g. Crust, Filling"
                className="flex-1 px-3 py-1.5 rounded-lg border text-xs outline-none bg-black/20 focus:border-indigo-500"
                style={{ borderColor: 'var(--color-border-subtle)' }}
              />
              <button
                onClick={createPalette}
                disabled={selectedColors.size === 0 || !newPaletteName.trim()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-lg font-bold text-xs"
              >
                Create
              </button>
            </div>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              Select colors on the image or list below ({selectedColors.size} selected)
            </p>
          </div>
        )}

        {/* Active Sprite Parts List */}
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Active Sprite Parts
          </h3>
          {Object.keys(activeParts).length === 0 ? (
            <p className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>No parts defined yet. Select colors and name a part above.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {Object.entries(activeParts).map(([name, colors]) => (
                <div key={name} className="border p-3 rounded-lg flex flex-col gap-2 relative bg-black/10 hover:bg-black/25 transition-all" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-indigo-400">{name}</span>
                    <div className="flex items-center gap-2">
                      {selectedColors.size > 0 && (
                        <button
                          onClick={() => {
                            const newColors = Array.from(selectedColors);
                            const nextColors = Array.from(new Set([...colors, ...newColors]));
                            setActiveParts(prev => ({
                              ...prev,
                              [name]: nextColors
                            }));

                            setColorAssignments(prev => {
                              const updated = { ...prev };
                              for (const hex of newColors) {
                                updated[hex] = name;
                              }
                              return updated;
                            });
                            setSelectedColors(new Set());
                          }}
                          className="text-[9px] bg-indigo-600/80 hover:bg-indigo-600 text-white rounded px-1.5 py-0.5 font-bold animate-pulse"
                        >
                          + Add ({selectedColors.size})
                        </button>
                      )}
                      {saveConfirmName === name ? (
                        <div className="flex items-center gap-1.5 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px]">
                          <span className="text-amber-400 font-bold">Merge colors?</span>
                          <button
                            onClick={() => mergePartToLibrary(name)}
                            className="text-emerald-400 hover:text-emerald-300 font-bold bg-none border-none cursor-pointer"
                          >
                            Confirm
                          </button>
                          <span className="text-gray-600">|</span>
                          <button
                            onClick={() => setSaveConfirmName(null)}
                            className="text-gray-400 hover:text-white bg-none border-none cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => savePartToLibrary(name)}
                          className="text-[10px] text-emerald-400 hover:underline bg-none border-none cursor-pointer"
                          title="Save to Library"
                        >
                          Save to Library
                        </button>
                      )}
                      <button
                        onClick={() => deletePalette(name)}
                        className="text-[10px] text-red-400 hover:underline bg-none border-none cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {/* Swatches */}
                  <div className="flex flex-wrap gap-1">
                    {colors.map(c => (
                      <div
                        key={c}
                        className="w-5 h-5 rounded border border-white/20"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                  {/* Swap Select */}
                  {(() => {
                    const sQuery = comboboxSearch[name] !== undefined ? comboboxSearch[name] : (activeMaterialSwaps[name] || '');
                    const filteredSwaps = Object.keys(customPalettes)
                      .filter(p => p.toLowerCase().includes(sQuery.toLowerCase()))
                      .sort((a, b) => {
                        const groupA = paletteGroups[a] || '';
                        const groupB = paletteGroups[b] || '';
                        if (groupA && !groupB) return -1;
                        if (!groupA && groupB) return 1;
                        if (groupA !== groupB) return groupA.localeCompare(groupB);
                        return a.localeCompare(b);
                      });

                    const groupedSwaps = {};
                    filteredSwaps.forEach(p => {
                      const grp = paletteGroups[p] || '(No Group)';
                      if (!groupedSwaps[grp]) groupedSwaps[grp] = [];
                      groupedSwaps[grp].push(p);
                    });

                    return (
                      <div className="flex flex-col gap-1 mt-1">
                        <label className="text-[10px] uppercase font-bold" style={{ color: 'var(--color-text-muted)' }}>Swap with:</label>
                        <div className="relative w-full">
                          <input
                            type="text"
                            placeholder="Select or search material..."
                            value={comboboxSearch[name] !== undefined ? comboboxSearch[name] : (activeMaterialSwaps[name] || '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setComboboxSearch(prev => ({ ...prev, [name]: val }));
                              if (!val) {
                                setActiveMaterialSwaps(prev => ({ ...prev, [name]: '' }));
                              }
                            }}
                            onFocus={() => {
                              setOpenComboboxPart(name);
                              setComboboxSearch(prev => ({ ...prev, [name]: activeMaterialSwaps[name] || '' }));
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setOpenComboboxPart(null);
                                setComboboxSearch(prev => {
                                  const updated = { ...prev };
                                  delete updated[name];
                                  return updated;
                                });
                              }, 200);
                            }}
                            className="w-full px-2 py-1 border rounded bg-neutral-900 text-[11px] outline-none text-white pr-6 focus:border-indigo-500/50"
                            style={{ borderColor: 'var(--color-border-subtle)' }}
                          />
                          <span className="absolute right-2 top-1.5 text-gray-500 pointer-events-none text-[8px]">▼</span>

                          {openComboboxPart === name && (
                            <div
                              className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto z-50 border rounded bg-neutral-950/95 shadow-xl p-1 text-[11px] flex flex-col gap-1"
                              style={{ borderColor: 'var(--color-border-subtle)' }}
                            >
                              <div
                                onMouseDown={() => {
                                  setActiveMaterialSwaps(prev => ({ ...prev, [name]: '' }));
                                  setComboboxSearch(prev => ({ ...prev, [name]: '' }));
                                }}
                                className="px-2 py-1 hover:bg-white/10 rounded cursor-pointer text-gray-400 font-bold"
                              >
                                (No Swap)
                              </div>

                              {Object.entries(groupedSwaps).map(([groupName, items]) => (
                                <div key={groupName} className="flex flex-col gap-0.5 border-t border-white/5 pt-1">
                                  <div className="px-2 py-0.5 text-[8.5px] font-extrabold uppercase text-indigo-400/80 bg-white/5 rounded">
                                    {groupName}
                                  </div>
                                  {items.map(p => (
                                    <div
                                      key={p}
                                      onMouseDown={() => {
                                        setActiveMaterialSwaps(prev => ({ ...prev, [name]: p }));
                                        setComboboxSearch(prev => ({ ...prev, [name]: p }));
                                      }}
                                      className="px-3 py-1 hover:bg-white/10 rounded cursor-pointer text-white flex items-center justify-between"
                                    >
                                      <span>{p}</span>
                                      {activeMaterialSwaps[name] === p && <span className="text-emerald-400 text-[8px]">✓</span>}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Swatch Inspector list */}
        {imageSrc && (
          <div className="flex-1 flex flex-col min-h-0 border-t pt-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Color Swatch List
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsPinMode(!isPinMode)}
                  className={`px-2 py-1 rounded text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${isPinMode
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                      : 'bg-black/20 text-gray-400 border-white/10 hover:bg-white/5 hover:text-white'
                    }`}
                  title="Toggle Pin Mode. When active, clicking on swatches or pixels on the canvas will pin/unpin them, preventing them from snapping."
                >
                  📌 {isPinMode ? 'Pin ON' : 'Pin OFF'}
                </button>
                {pinnedColors.size > 0 && (
                  <button
                    onClick={() => setPinnedColors(new Set())}
                    className="px-2 py-1 rounded text-[10px] font-bold bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-900/20 cursor-pointer"
                    title="Clear all pinned colors"
                  >
                    Clear ({pinnedColors.size})
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1">

              {/* Grouped Colors */}
              {Object.keys(activeParts).map(palName => {
                const colors = activeParts[palName];
                return (
                  <div key={palName} className="flex flex-col gap-1.5">
                    <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                      <SwatchBook size={12} /> {palName}
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {colors.map(hex => (
                        <button
                          key={hex}
                          onClick={() => {
                            const nextColors = colors.filter(c => c !== hex);
                            if (nextColors.length === 0) {
                              deletePalette(palName);
                            } else {
                              setActiveParts(prev => ({
                                ...prev,
                                [palName]: nextColors
                              }));
                            }

                            setColorAssignments(prev => {
                              const updated = { ...prev };
                              delete updated[hex];
                              return updated;
                            });
                          }}
                          className="w-8 h-8 rounded border border-white/20 relative group overflow-hidden cursor-pointer flex items-center justify-center hover:scale-105 transition-all"
                          style={{ backgroundColor: hex }}
                          title={`${hex} (Click to remove from ${palName})`}
                        >
                          <span className="hidden group-hover:block text-[8px] text-white bg-black/80 font-bold px-1 rounded">X</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Ungrouped Colors */}
              <div className="flex flex-col gap-1.5">
                <div className="text-xs font-bold text-yellow-500 flex items-center gap-1.5">
                  <Layers size={12} /> Ungrouped Colors
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {simplifiedColors.filter(hex => !colorAssignments[hex]).map(hex => {
                    const isSelected = selectedColors.has(hex);
                    const isPinned = pinnedColors.has(hex);
                    return (
                      <button
                        key={hex}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (isPinMode) {
                            setPinnedColors(prev => {
                              const next = new Set(prev);
                              if (next.has(hex)) { next.delete(hex); } else { next.add(hex); }
                              return next;
                            });
                          } else {
                            handleSwatchMouseDown(hex);
                          }
                        }}
                        onMouseEnter={() => !isPinMode && handleSwatchMouseEnter(hex)}
                        className={`w-8 h-8 rounded border cursor-pointer hover:scale-105 transition-all flex items-center justify-center relative ${isPinned
                            ? 'border-amber-400 ring-2 ring-amber-500/50'
                            : isSelected
                              ? 'border-emerald-400 scale-105 ring-2 ring-emerald-500'
                              : 'border-white/20'
                          }`}
                        style={{ backgroundColor: hex }}
                        title={`${hex}${isPinned ? ' (pinned)' : ''}`}
                      >
                        {isPinned && <span className="text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">📌</span>}
                        {!isPinned && isSelected && <span className="text-[10px] text-white bg-black/50 rounded-full w-4 h-4 flex items-center justify-center font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar 2: Persistent Material Library */}
      <div className="w-80 flex flex-col gap-4 overflow-y-auto p-4 rounded-xl border h-full"
        style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>

        {/* Material Library Section */}
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 border-b pb-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground" style={{ color: 'var(--color-text-muted)' }}>
              Material Library
            </h3>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library..."
              className="px-2 py-1 text-xs rounded border bg-black/10 outline-none w-36 text-white"
              style={{ borderColor: 'var(--color-border-subtle)' }}
            />
          </div>
          {Object.keys(customPalettes).length === 0 ? (
            <p className="text-xs italic text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No saved materials. Save active parts to add them here.</p>
          ) : (
            <div className="flex flex-col gap-4 overflow-y-auto pr-1">
              {Object.entries(groupedPalettes).map(([groupName, entries]) => (
                <div key={groupName} className="flex flex-col gap-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 border-b border-indigo-500/20 pb-0.5 mt-1 flex items-center justify-between">
                    <span>{groupName}</span>
                    <span className="text-[9px] text-gray-500 font-normal">({entries.length})</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {entries.map(([name, colors]) => (
                      <div
                        key={name}
                        onClick={() => addLibraryPaletteToActive(name, colors)}
                        className="border p-3 rounded-lg flex flex-col gap-2 bg-black/10 hover:bg-black/20 hover:border-emerald-500/50 cursor-pointer transition-all"
                        style={{ borderColor: 'var(--color-border-subtle)' }}
                        title="Click to import to Active Sprite Parts"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-emerald-400">{name} ({colors.length})</span>
                          {deleteConfirmName === name ? (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextPalettes = { ...customPalettes };
                                  delete nextPalettes[name];
                                  setCustomPalettes(nextPalettes);
                                  savePalettes(nextPalettes);
                                  setDeleteConfirmName(null);
                                }}
                                className="text-[10px] text-red-400 hover:text-red-300 font-bold bg-none border-none cursor-pointer"
                              >
                                Confirm?
                              </button>
                              <span className="text-[10px] text-muted-foreground">|</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmName(null);
                                }}
                                className="text-[10px] text-gray-400 hover:text-white bg-none border-none cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingPalette(name, colors);
                                }}
                                className="text-[10px] text-indigo-400 hover:underline bg-none border-none cursor-pointer"
                              >
                                Edit
                              </button>
                              <span className="text-[10px] text-muted-foreground">|</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // Avoid triggering import when deleting
                                  setDeleteConfirmName(name);
                                }}
                                className="text-[10px] text-red-400 hover:underline bg-none border-none cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {colors.map(c => (
                            <div
                              key={c}
                              className="w-5 h-5 rounded border border-white/10"
                              style={{ backgroundColor: c }}
                              title={c}
                            />
                          ))}
                        </div>

                        {/* Group Selection */}
                        {isCreatingGroupFor === name ? (
                          <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              placeholder="New group..."
                              className="bg-black/30 border border-white/20 rounded px-1.5 py-0.5 text-[10px] text-white outline-none w-32 focus:border-indigo-500/50"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = e.target.value.trim();
                                  if (val) {
                                    const updated = { ...paletteGroups, [name]: val };
                                    setPaletteGroups(updated);
                                    savePaletteGroups(updated);
                                  }
                                  setIsCreatingGroupFor(null);
                                } else if (e.key === 'Escape') {
                                  setIsCreatingGroupFor(null);
                                }
                              }}
                              autoFocus
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsCreatingGroupFor(null);
                              }}
                              className="text-[10px] text-gray-400 hover:text-white bg-none border-none cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[10px] uppercase font-bold text-gray-500">Group:</span>
                            <select
                              value={paletteGroups[name] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__new__') {
                                  setIsCreatingGroupFor(name);
                                } else {
                                  const updated = { ...paletteGroups, [name]: val };
                                  setPaletteGroups(updated);
                                  savePaletteGroups(updated);
                                }
                              }}
                              className="bg-black/30 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white outline-none cursor-pointer w-32"
                            >
                              <option value="">(None)</option>
                              {uniqueGroups.map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                              <option value="__new__">+ New Group...</option>
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
