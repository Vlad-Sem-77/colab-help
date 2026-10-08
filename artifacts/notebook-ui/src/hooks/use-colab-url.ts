import { useState, useEffect } from "react";

const COLAB_URL_STORAGE_KEY = "colab_url";
const COLAB_URL_CHANGED_EVENT = "notebook-colab-url-changed";

export function useColabUrl() {
  const [colabUrl, setColabUrl] = useState(() => {
    try {
      return localStorage.getItem(COLAB_URL_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    const syncColabUrl = () => {
      try {
        setColabUrl(localStorage.getItem(COLAB_URL_STORAGE_KEY) || "");
      } catch {
        setColabUrl("");
      }
    };
    window.addEventListener("storage", syncColabUrl);
    window.addEventListener(COLAB_URL_CHANGED_EVENT, syncColabUrl);
    return () => {
      window.removeEventListener("storage", syncColabUrl);
      window.removeEventListener(COLAB_URL_CHANGED_EVENT, syncColabUrl);
    };
  }, []);

  const updateColabUrl = (nextUrl: string) => {
    setColabUrl(nextUrl);
    try {
      if (nextUrl) {
        localStorage.setItem(COLAB_URL_STORAGE_KEY, nextUrl);
      } else {
        localStorage.removeItem(COLAB_URL_STORAGE_KEY);
      }
    } catch {
      // The current session still works when browser storage is unavailable.
    }
    window.dispatchEvent(new Event(COLAB_URL_CHANGED_EVENT));
  };

  return { colabUrl, setColabUrl: updateColabUrl };
}
