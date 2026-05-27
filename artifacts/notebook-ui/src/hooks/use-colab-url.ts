import { useState, useEffect } from "react";

export function useColabUrl() {
  const [colabUrl, setColabUrl] = useState(() => {
    return localStorage.getItem("colab_url") || "";
  });

  useEffect(() => {
    if (colabUrl) {
      localStorage.setItem("colab_url", colabUrl);
    } else {
      localStorage.removeItem("colab_url");
    }
  }, [colabUrl]);

  return { colabUrl, setColabUrl };
}
