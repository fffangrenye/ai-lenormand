"use client";

import { MouseEvent, PointerEvent, useRef } from "react";

type CardSpreadImage = {
  src: string;
  label: string;
};

function loadCardImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = new URL(src, window.location.origin).href;
  });
}

async function saveCardSpreadImage(images: CardSpreadImage[], fileName: string) {
  if (!images.length) return;

  const loadedImages = await Promise.all(images.map((image) => loadCardImage(image.src)));
  const cardWidth = 360;
  const cardHeight = Math.round(cardWidth * (loadedImages[0].naturalHeight / loadedImages[0].naturalWidth));
  const gap = images.length > 1 ? 24 : 0;
  const padding = 32;
  const canvas = document.createElement("canvas");
  canvas.width = padding * 2 + images.length * cardWidth + (images.length - 1) * gap;
  canvas.height = padding * 2 + cardHeight;

  const context = canvas.getContext("2d");
  if (!context) return;

  context.fillStyle = "#f5f1e8";
  context.fillRect(0, 0, canvas.width, canvas.height);

  loadedImages.forEach((image, index) => {
    const x = padding + index * (cardWidth + gap);
    context.drawImage(image, x, padding, cardWidth, cardHeight);
  });

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function useCardSpreadLongPressSave(getImages: () => CardSpreadImage[], fileName: string) {
  const timerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const lastSaveAtRef = useRef(0);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPointRef.current = null;
  }

  async function save() {
    const now = Date.now();
    if (now - lastSaveAtRef.current < 1200) return;
    if (savingRef.current) return;
    savingRef.current = true;
    lastSaveAtRef.current = now;

    try {
      await saveCardSpreadImage(getImages(), fileName);
    } finally {
      savingRef.current = false;
    }
  }

  function start(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearTimer();
    startPointRef.current = { x: event.clientX, y: event.clientY };
    timerRef.current = window.setTimeout(() => {
      void save();
    }, 700);
  }

  function move(event: PointerEvent<HTMLElement>) {
    if (!startPointRef.current) return;

    const distanceX = Math.abs(event.clientX - startPointRef.current.x);
    const distanceY = Math.abs(event.clientY - startPointRef.current.y);
    if (distanceX > 10 || distanceY > 10) clearTimer();
  }

  return {
    onPointerDown: start,
    onPointerMove: move,
    onPointerUp: clearTimer,
    onPointerLeave: clearTimer,
    onPointerCancel: clearTimer,
    onContextMenu: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      clearTimer();
      void save();
    }
  };
}
