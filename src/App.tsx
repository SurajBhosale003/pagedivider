import React, { useState, useEffect, useRef } from 'react';
import { splitPDF } from './pageConvertPackage/GetPages';
import { pdfToBase64 } from './pageConvertPackage/PDFtoBase64';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { PDFDocument, rgb } from 'pdf-lib';
import ArialFontBytes from './fonts/Montserrat-Light.ttf';
import 'pdfjs-dist/build/pdf.worker.mjs';
import * as fontkit from 'fontkit'; 

type Spawner = {
  page: number;
  posX: number;
  posY: number;
};

const App: React.FC = () => {
  const [base64PDF, setBase64PDF] = useState<string | null>(null);
  const [pages, setPages] = useState<Array<{ page: number; data: string }> | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [spawners, setSpawners] = useState<Spawner[]>([]);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (pages) {
      renderPage(pages[currentPage - 1].data, pageRefs.current[currentPage - 1]);
    }
  }, [pages, currentPage]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const base64String = await pdfToBase64(file);
      setBase64PDF(base64String);
    }
  };

  const handleConvert = async () => {
    if (base64PDF) {
      const result = await splitPDF(base64PDF);
      setPages(result);
      setCurrentPage(1);
      setSpawners([]);
    }
  };

  const renderPage = async (pageData: string, container: HTMLDivElement | null) => {
    if (container) {
      const pdf = await pdfjsLib.getDocument({ data: atob(pageData) }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });

      container.innerHTML = '';

      container.style.width = `${viewport.width}px`;
      container.style.height = `${viewport.height}px`;
      container.style.position = 'relative';

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        container.appendChild(canvas);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        await page.render(renderContext).promise;

        renderSpawners(page.pageNumber, container);
      }
    }
  };

  const renderSpawners = (pageNumber: number, container: HTMLDivElement) => {
    const spawnersOnPage = spawners.filter(spawner => spawner.page === pageNumber);
    spawnersOnPage.forEach(spawner => {
      const spawnerElement = document.createElement('div');
      spawnerElement.className = 'spawner';
      spawnerElement.style.position = 'absolute';
      spawnerElement.style.left = `${spawner.posX}px`;
      spawnerElement.style.top = `${spawner.posY}px`;
      spawnerElement.draggable = true;
      spawnerElement.addEventListener('dragstart', (event) => onDragStart(event, spawner));
      container.appendChild(spawnerElement);
    });
  };

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, spawner: Spawner) => {
    event.dataTransfer.setData('text/plain', JSON.stringify(spawner));
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    console.log('Drag over detected');
  };

  const onDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const data = event.dataTransfer.getData('text/plain');
    if (!data) {
      console.error('No data found in drag event.');
      return;
    }

    try {
      const spawner = JSON.parse(data) as Spawner;
      const newX = event.clientX - (pageRefs.current[spawner.page - 1]?.getBoundingClientRect().left || 0);
      const newY = event.clientY - (pageRefs.current[spawner.page - 1]?.getBoundingClientRect().top || 0);
      console.log('New X:', newX, 'New Y:', newY);

      const pdfDoc = await PDFDocument.load(pages![currentPage - 1].data);
      pdfDoc.registerFontkit(fontkit);

      const fontBytes = await fetch(ArialFontBytes).then((res) => res.arrayBuffer());
      const font = await pdfDoc.embedFont(fontBytes);

      const page = pdfDoc.getPage(0);
      page.drawText('Hello, World!', {
        x: newX,
        y: page.getSize().height - newY,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });

      const modifiedPdfBytes = await pdfDoc.saveAsBase64();
      setPages((prevPages) =>
        prevPages
          ? prevPages.map((page, index) => (index === currentPage - 1 ? { ...page, data: modifiedPdfBytes } : page))
          : null
      );
    } catch (error) {
      console.error('Error parsing JSON data or modifying PDF:', error);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (pages && currentPage < pages.length) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="app-container">
      <h1>PDF Viewer and Editor</h1>
      <input type="file" accept="application/pdf" onChange={handleFileChange} />
      <button onClick={handleConvert} disabled={!base64PDF}>
        Convert
      </button>
      <div className="navigation">
        <button onClick={goToPreviousPage} disabled={currentPage === 1}>
          Previous
        </button>
        <span>
          Page {currentPage} of {pages?.length || 0}
        </span>
        <button onClick={goToNextPage} disabled={currentPage === (pages?.length || 0)}>
          Next
        </button>
      </div>
      {pages &&
        pages.map((page, index) => (
          <div key={index} className={`page-container ${index + 1 === currentPage ? 'active' : ''}`}>
            <h2>Page {page.page}</h2>
            <div
              ref={(ref) => (pageRefs.current[index] = ref)}
              className="pdf-page"
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          </div>
        ))}
      <div className="spawner-container">
        <div
          className="spawner"
          draggable={true}
          onDragStart={(event) => onDragStart(event, { page: 1, posX: 0, posY: 0 })}
        >
          Spawner Component
        </div>
      </div>
    </div>
  );
};

export default App;
