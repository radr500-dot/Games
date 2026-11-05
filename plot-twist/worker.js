// Generates puzzles off the main thread so the screen never freezes.
importScripts('generator.js', 'hints.js');
self.onmessage = (e) => {
  const { id, size, seed } = e.data;
  try {
    const p = self.PlotTwistEngine.generateCasual(size, seed, self.PlotTwistHints);
    self.postMessage({ id, puzzle: p });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
