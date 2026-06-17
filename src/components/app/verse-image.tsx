import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button, Sheet } from "./ui";

/**
 * Renders a shareable square verse image on a canvas using the brand palette
 * and serif type — beautiful, on-brand, and free social marketing. Offers
 * native share (Web Share API) with a download fallback.
 */
export function VerseImageSheet({
  open,
  onClose,
  reference,
  text,
}: {
  open: boolean;
  onClose: () => void;
  reference: string;
  text: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        await (document as any).fonts?.ready;
      } catch {
        /* fonts API unavailable — draw with fallbacks */
      }
      if (!cancelled) draw();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reference, text]);

  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const W = 1080;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#13284a");
    grad.addColorStop(1, "#0a182e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";

    ctx.fillStyle = "rgba(248,243,236,0.12)";
    ctx.font = "italic 220px 'Source Serif 4', Georgia, serif";
    ctx.fillText("“", W / 2, 250);

    ctx.fillStyle = "#f8f3ec";
    ctx.font = "italic 54px 'Source Serif 4', Georgia, serif";
    const lines = wrap(ctx, text, W - 220);
    const lineH = 80;
    let y = H / 2 - ((lines.length - 1) * lineH) / 2;
    for (const ln of lines) {
      ctx.fillText(ln, W / 2, y);
      y += lineH;
    }

    ctx.fillStyle = "#cda86f";
    ctx.font = "700 30px 'Hanken Grotesk', system-ui, sans-serif";
    ctx.fillText(reference.toUpperCase(), W / 2, H - 156);

    ctx.fillStyle = "rgba(248,243,236,0.5)";
    ctx.font = "600 24px 'Hanken Grotesk', system-ui, sans-serif";
    ctx.fillText("Discipleship Companion", W / 2, H - 96);
  }

  function wrap(ctx: CanvasRenderingContext2D, str: string, maxW: number) {
    const words = str.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  const fileName = `${reference.replace(/[^a-z0-9]+/gi, "-")}.png`;

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = fileName;
    a.click();
  }

  function share() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], fileName, { type: "image/png" });
      const nav = navigator as any;
      if (nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: reference });
        } catch {
          /* user cancelled */
        }
      } else {
        download();
        toast("Image saved — share it from your downloads.");
      }
    }, "image/png");
  }

  return (
    <Sheet open={open} onClose={onClose} title="Share this verse">
      <div className="space-y-4">
        <canvas
          ref={canvasRef}
          aria-label={`Verse image for ${reference}`}
          className="aspect-square w-full rounded-xl shadow-md"
        />
        <div className="grid grid-cols-2 gap-gutter">
          <Button variant="secondary" leftIcon="download" onClick={download}>
            Save image
          </Button>
          <Button leftIcon="ios_share" onClick={share}>
            Share
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
