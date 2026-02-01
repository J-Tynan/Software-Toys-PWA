self.addEventListener('message', (e) => {
  const { type, payload } = e.data || {};
  if (type === 'terminate') {
    self.close();
    return;
  }

  if (type === 'setParams') {
    return;
  }

  if (type === 'render') {
    const { width, height } = payload;
    const buffer = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        buffer[i] = (x / width) * 255;
        buffer[i + 1] = (y / height) * 255;
        buffer[i + 2] = 180;
        buffer[i + 3] = 255;
      }
    }

    self.postMessage({
      type: 'result',
      payload: { width, height, buffer }
    }, [buffer.buffer]);
  }
});
