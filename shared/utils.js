// Shared utility functions for all toys

// Random number between min/max
function random(min, max) {
  return Math.random() * (max - min) + min;
}

// Hex to RGB (for color manipulation, e.g., in fractals)
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Linear interpolation (lerp) for smooth transitions (e.g., animations, zooms)
function lerp(start, end, t) {
  return start * (1 - t) + end * t;
}

// Easing function (easeInOutQuad) for demo modes
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Theme-aware color getter (uses CSS vars from DaisyUI)
function getThemeColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// Centralized settings keys and helpers
const SETTINGS_KEYS = {
  SOUND: 'soundEnabled',
  SHOW_FPS: 'showFps',
  EXPORT_QUALITY: 'exportQuality',
  VIBRATION: 'vibrationEnabled',
  GLOBAL_THEME: 'globalTheme',
  SYSTEM_THEME: 'systemThemeEnabled'
};

// Sound helpers
function isSoundEnabled() {
  return localStorage.getItem(SETTINGS_KEYS.SOUND) === 'true';
}
function setSoundEnabled(enable) {
  localStorage.setItem(SETTINGS_KEYS.SOUND, !!enable);
}
function toggleSound(enable) {
  setSoundEnabled(enable);
  // Optional: Vibrate if supported and enabled (for mobile PWAs)
  if (enable && 'vibrate' in navigator) {
    navigator.vibrate(50); // Short haptic feedback
  }
}

// Show FPS
function isShowFps() {
  return localStorage.getItem(SETTINGS_KEYS.SHOW_FPS) === 'true';
}
function setShowFps(enable) {
  localStorage.setItem(SETTINGS_KEYS.SHOW_FPS, !!enable);
}

// Export quality
function getExportQuality() {
  return localStorage.getItem(SETTINGS_KEYS.EXPORT_QUALITY) || 'hd';
}
function setExportQuality(val) {
  localStorage.setItem(SETTINGS_KEYS.EXPORT_QUALITY, val);
}

// Theme helpers
function getGlobalTheme() {
  return localStorage.getItem(SETTINGS_KEYS.GLOBAL_THEME);
}
function setGlobalTheme(val) {
  localStorage.setItem(SETTINGS_KEYS.GLOBAL_THEME, val);
}
function isSystemThemeEnabled() {
  return localStorage.getItem(SETTINGS_KEYS.SYSTEM_THEME) === 'true';
}
function setSystemThemeEnabled(enable) {
  localStorage.setItem(SETTINGS_KEYS.SYSTEM_THEME, !!enable);
}

// Export for use in other scripts
window.utils = Object.assign(window.utils || {}, {
  random, hexToRgb, lerp, easeInOutQuad, getThemeColor,
  // sound
  isSoundEnabled, setSoundEnabled, toggleSound,
  // fps
  isShowFps, setShowFps,
  // export
  getExportQuality, setExportQuality,
  // theme
  getGlobalTheme, setGlobalTheme, isSystemThemeEnabled, setSystemThemeEnabled
});

// Global vibration (haptics) - Check user preference before vibrating
function isVibrationEnabled() {
  // Default: OFF unless user explicitly enabled
  return localStorage.getItem('vibrationEnabled') === 'true';
}

// Optional: Toggle function if toys need to change it (rare, since homepage controls it)
function toggleVibration(enable) {
  localStorage.setItem('vibrationEnabled', !!enable);
}

// Load global theme on toy startup (overrides HTML default)
function loadGlobalTheme() {
  const savedTheme = getGlobalTheme();
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else {
    // Fallback to emerald if nothing saved
    document.documentElement.setAttribute('data-theme', 'emerald');
  }
} 

// Apply the saved theme or follow system preference when enabled
function applyGlobalTheme() {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const systemOn = isSystemThemeEnabled();
  let theme;
  if (systemOn) theme = mediaQuery.matches ? 'luxury' : 'emerald';
  else theme = getGlobalTheme() === 'luxury' ? 'luxury' : 'emerald';

  document.documentElement.setAttribute('data-theme', theme);

  // Dispatch an event so other pages/scripts can react immediately
  try { window.dispatchEvent(new CustomEvent('global-theme-changed', { detail: { theme } })); } catch (e) { /* ignore */ }

  // Sync UI controls if present
  const globalThemeToggle = document.getElementById('global-theme-toggle');
  if (globalThemeToggle) globalThemeToggle.checked = getGlobalTheme() === 'luxury';

  const systemToggle = document.getElementById('global-system-theme-toggle');
  if (systemToggle) systemToggle.checked = systemOn;

  const headerThemeToggle = document.getElementById('theme-toggle');
  if (headerThemeToggle) {
    if (systemOn) {
      headerThemeToggle.checked = mediaQuery.matches;
      headerThemeToggle.disabled = true;
    } else {
      headerThemeToggle.checked = getGlobalTheme() === 'luxury';
      headerThemeToggle.disabled = false;
    }
  }
} 

// React to system changes when following system theme
const _systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
_systemMediaQuery.addEventListener('change', () => {
  if (isSystemThemeEnabled()) applyGlobalTheme();
});

// React to cross-window changes
window.addEventListener('storage', (ev) => {
  if (ev.key === 'systemThemeEnabled' || ev.key === 'globalTheme') applyGlobalTheme();
});

// If a tab becomes visible, re-apply the global theme (handles background tabs)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') applyGlobalTheme();
});

// Optional: Apply initial vibration feedback on load if enabled (fun touch)
if (isVibrationEnabled() && 'vibrate' in navigator) {
  navigator.vibrate(20); // Gentle buzz on app/toy open
}

// Export the helper
window.utils = Object.assign(window.utils, { loadGlobalTheme, applyGlobalTheme, isVibrationEnabled, toggleVibration });