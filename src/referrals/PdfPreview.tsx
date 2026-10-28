import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker&inline";

let workerStarted = false;

function ensurePdfWorker(): void {
  if (workerStarted) return;
  GlobalWorkerOptions.workerPort = new PdfWorker();
  workerStarted = true;
}

export function standardFontDataUrl(): string {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}standard_fonts/`;
}

/** Draws the filled PDF in the page. Blob iframes stay blank in Chrome, Safari, and mobile. */
export default function PdfPreview(props: { data: Uint8Array; fallbackUrl: string | null }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"drawing" | "ready" | "error">("drawing");
  const [error, setError] = useState("");

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let cancel = false;
    setStatus("drawing");
    setError("");
    root.replaceChildren();
    const copy = props.data.slice();
    (async () => {
      ensurePdfWorker();
      const doc = await getDocument({ data: copy, standardFontDataUrl: standardFontDataUrl() }).promise;
      try {
        if (cancel) return;
        const targetWidth = Math.min(860, Math.max(280, root.clientWidth - 24));
        const pixel = Math.min(2, window.devicePixelRatio || 1);
        for (let i = 1; i <= doc.numPages; i += 1) {
          const page = await doc.getPage(i);
          if (cancel) return;
          const unscaled = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (targetWidth / unscaled.width) * pixel });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) throw new Error("This browser could not draw the PDF preview.");
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancel) return;
          const figure = document.createElement("figure");
          figure.className = "rh-pdf-page";
          const caption = document.createElement("figcaption");
          caption.textContent = `Page ${i} of ${doc.numPages}`;
          canvas.setAttribute("aria-label", `Filled referral form, page ${i} of ${doc.numPages}`);
          figure.append(canvas, caption);
          root.append(figure);
          page.cleanup();
        }
        if (!cancel) setStatus(doc.numPages > 0 ? "ready" : "error");
        if (!cancel && doc.numPages === 0) setError("The filled PDF has no pages.");
      } finally {
        await doc.destroy();
      }
    })().catch((e: unknown) => {
      if (cancel) return;
      setStatus("error");
      setError(e instanceof Error ? e.message : "The filled PDF could not be drawn.");
    });
    return () => {
      cancel = true;
      root.replaceChildren();
    };
  }, [props.data]);

  return (
    <div className="stack">
      {status === "drawing" ? <p className="caption">Drawing the filled form…</p> : null}
      {status === "error" ? <p className="rh-error" role="alert">{error} Use Open preview or Download filled PDF.</p> : null}
      <div ref={host} className="rh-pdf" aria-label="Filled referral form preview" hidden={status === "error"} />
      {status === "error" && props.fallbackUrl ? (
        <object className="rh-preview" data={props.fallbackUrl} type="application/pdf" aria-label="Filled referral form">
          <p>Open preview or download the filled PDF.</p>
        </object>
      ) : null}
    </div>
  );
}
