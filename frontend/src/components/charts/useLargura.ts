import { useEffect, useRef, useState } from "react";

/** Largura real do elemento, para o SVG desenhar em pixels sem distorcer. */
export function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([entrada]) => setLargura(Math.floor(entrada.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, largura };
}
