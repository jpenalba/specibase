export const THEME_STORAGE_KEY = "specibase.theme";

export type Theme = "light" | "dark";

// Runs synchronously in <head>, before first paint, so the page never
// flashes the wrong theme while client JS is still loading.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){}})();`;
