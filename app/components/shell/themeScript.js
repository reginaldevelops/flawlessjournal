export const THEME_STORAGE_KEY = "flawless.theme";

/**
 * Runs before first paint so the stored theme is applied without a flash.
 * Kept in its own module so the server layout can import it without pulling in
 * client-only React code.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(!t||t==='system'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
