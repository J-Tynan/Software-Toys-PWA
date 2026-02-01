self.addEventListener('message', (e) => {
  const { type, payload } = e.data || {};
  if (type === 'terminate') {
    self.close();
    return;
  }

  if (type === 'setParams') {
    // TODO: store parameters for particle simulation
    return;
  }

  if (type === 'render') {
    const { width, height } = payload;
    const buffer = new Uint8ClampedArray(width * height * 4);

    // TODO: implement particle physics here (confetti, fireworks, aurora)
    // Placeholder: static night-sky gradient with sparse stars.
    const starCount = Math.max(60, Math.floor((width * height) / 20000));
    const stars = Array.from({ length: starCount }, () => ({
      x: Math.floor(Math.random() * width),
      y: Math.floor(Math.random() * height),
      r: 180 + Math.floor(Math.random() * 75)
    }));

    for (let y = 0; y < height; y++) {
      if (y % Math.max(1, Math.floor(height / 6)) === 0) {
        const percent = Math.round((y / height) * 100);
        self.postMessage({ type: 'progress', payload: { percent } });
      }
      const t = y / height;
      const rBase = 10 + Math.floor(30 * t);
      const gBase = 18 + Math.floor(40 * t);
      const bBase = 40 + Math.floor(70 * t);
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        buffer[i] = rBase;
        buffer[i + 1] = gBase;
        buffer[i + 2] = bBase;
        buffer[i + 3] = 255;
      }
    }

    stars.forEach(({ x, y, r }) => {
      const i = (y * width + x) * 4;
      buffer[i] = r;
      buffer[i + 1] = r;
      buffer[i + 2] = r;
      buffer[i + 3] = 255;
    });

    self.postMessage({
      type: 'result',
      payload: { width, height, yStart: 0, bandHeight: height, buffer }
    }, [buffer.buffer]);
  }
});
