"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.drawSvgToCanvas = drawSvgToCanvas;
exports.svgToPngBuffer = svgToPngBuffer;
exports.svgToPngBufferWithFallback = svgToPngBufferWithFallback;
function resolveNodeRequire() {
    try {
        return (0, eval)("require");
    }
    catch {
        // Fall through to ESM-compatible resolution.
    }
    const maybeGlobalRequire = globalThis.require;
    if (typeof maybeGlobalRequire === "function") {
        return maybeGlobalRequire;
    }
    const processValue = globalThis.process;
    const moduleValue = processValue?.getBuiltinModule?.("module");
    if (moduleValue?.createRequire) {
        const cwd = processValue?.cwd ? processValue.cwd() : ".";
        const fromPath = `${cwd}/package.json`;
        return moduleValue.createRequire(fromPath);
    }
    throw new Error("Node rasterization is unavailable outside a Node environment.");
}
function renderWithResvg(svg, width) {
    const require = resolveNodeRequire();
    const { Resvg } = require("@resvg/resvg-js");
    const renderer = new Resvg(svg, {
        fitTo: { mode: "width", value: width },
        background: "rgba(0,0,0,0)",
    });
    return Buffer.from(renderer.render().asPng());
}
async function renderWithSharp(svg) {
    const require = resolveNodeRequire();
    const sharpModule = require("sharp");
    const sharpFactory = sharpModule.default;
    if (typeof sharpFactory !== "function") {
        throw new Error("sharp fallback is not available.");
    }
    return sharpFactory(Buffer.from(svg)).png().toBuffer();
}
function createCanvas(size) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    return canvas;
}
function getCanvasContext(canvas) {
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Unable to acquire 2D canvas context.");
    }
    return context;
}
function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("The source image could not be decoded."));
        image.src = url;
    });
}
async function drawSvgToCanvas(svg, size = 512) {
    if (typeof window === "undefined" || typeof document === "undefined") {
        throw new Error("drawSvgToCanvas is only available in a browser environment.");
    }
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
        if (typeof createImageBitmap === "function") {
            try {
                const bitmap = await createImageBitmap(blob);
                const canvas = createCanvas(size);
                const context = getCanvasContext(canvas);
                context.clearRect(0, 0, size, size);
                context.drawImage(bitmap, 0, 0, size, size);
                bitmap.close();
                return canvas;
            }
            catch {
                // Fall back to HTMLImageElement decode for browsers that reject SVG ImageBitmaps.
            }
        }
        const image = await loadImageFromUrl(url);
        const canvas = createCanvas(size);
        const context = getCanvasContext(canvas);
        context.clearRect(0, 0, size, size);
        context.drawImage(image, 0, 0, size, size);
        return canvas;
    }
    finally {
        URL.revokeObjectURL(url);
    }
}
function svgToPngBuffer(svg, size = 512) {
    try {
        return renderWithResvg(svg, size);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`svgToPngBuffer failed: ${message}`);
    }
}
async function svgToPngBufferWithFallback(svg, size = 512) {
    try {
        return renderWithResvg(svg, size);
    }
    catch {
        return renderWithSharp(svg);
    }
}
