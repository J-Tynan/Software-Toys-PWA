// Minimal worker that returns a placeholder gradient image buffer
self.addEventListener('message', (ev) => {
  const { type, payload } = ev.data || {};
  if (type === 'render') {
    const { renderDescriptor = {} } = payload || {};
    // Simple size heuristic; toys may pass width/height in descriptor
    const width = renderDescriptor.width || 400;
    const height = renderDescriptor.height || 300;

    // Create an RGBA gradient buffer
    const buf = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        buf[i] = (x / width) * 255; // R
        buf[i+1] = (y / height) * 255; // G
        buf[i+2] = ((x + y) / (width + height)) * 255; // B
        buf[i+3] = 255; // A
      }
    }

    // Post result as transferable
    postMessage({ type: 'result', payload: { width, height, buffer: buf.buffer } }, [buf.buffer]);
  } else if (type === 'terminate') {
    // Cleanup if needed
    self.close();
  } else if (type === 'setParams') {
    // TODO: accept and apply params
  }
});
