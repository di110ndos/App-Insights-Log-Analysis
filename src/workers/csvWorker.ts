import Papa from 'papaparse';

self.onmessage = (e: MessageEvent<File>) => {
  const file = e.data;

  Papa.parse(file, {
    header: true,
    dynamicTyping: false,
    skipEmptyLines: true,
    worker: false, // We're already in a worker
    chunk: (results) => {
      // Send chunks as they're parsed for progressive loading
      self.postMessage({
        type: 'chunk',
        data: results.data,
      });
    },
    complete: () => {
      self.postMessage({
        type: 'complete',
      });
    },
    error: (error) => {
      self.postMessage({
        type: 'error',
        error: error.message,
      });
    },
  });
};
