import { useEffect, useRef, useState } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorker;

export default function App() {
  const canvasRef = useRef(null);
  const [file, setFile] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [placements, setPlacements] = useState([]);
  const [status, setStatus] = useState('Upload a PDF to get started.');
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!pdfBytes) return;

    const render = async () => {
      const loadingTask = getDocument({ data: pdfBytes });
      const pdf = await loadingTask.promise;
      const firstPage = await pdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1.2 });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setViewportSize({ width: viewport.width, height: viewport.height });

      await firstPage.render({ canvasContext: context, viewport }).promise;

      context.fillStyle = '#d93025';
      context.font = '16px sans-serif';
      placements.forEach((item) => {
        const x = item.xRatio * viewport.width;
        const y = item.yRatio * viewport.height;
        context.fillText(item.text, x, y);
      });
    };

    render().catch(() => setStatus('Could not preview this PDF.'));
  }, [pdfBytes, placements]);

  const handleUpload = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    const bytes = new Uint8Array(await selected.arrayBuffer());
    setFile(selected);
    setPdfBytes(bytes);
    setPlacements([]);
    setStatus('Click anywhere on the preview to add text.');
  };

  const handleCanvasClick = (event) => {
    if (!viewportSize.width || !viewportSize.height) return;

    const text = window.prompt('Text to add:');
    if (!text) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setPlacements((prev) => [
      ...prev,
      {
        text,
        xRatio: x / viewportSize.width,
        yRatio: y / viewportSize.height
      }
    ]);
  };

  const handleDownload = async () => {
    if (!pdfBytes) return;

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.getPage(0);
    const { width, height } = page.getSize();

    placements.forEach((item) => {
      page.drawText(item.text, {
        x: item.xRatio * width,
        y: height - item.yRatio * height,
        size: 16,
        font,
        color: rgb(0.82, 0.18, 0.15)
      });
    });

    const editedBytes = await pdfDoc.save();
    const blob = new Blob([editedBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `edited-${file?.name || 'document.pdf'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main>
      <h1>Minimal PDF Editor</h1>
      <input type="file" accept="application/pdf" onChange={handleUpload} />

      {pdfBytes && (
        <>
          <p>{status}</p>
          <canvas ref={canvasRef} onClick={handleCanvasClick} className="preview" />
          <button onClick={handleDownload}>Download edited PDF</button>
        </>
      )}
    </main>
  );
}
