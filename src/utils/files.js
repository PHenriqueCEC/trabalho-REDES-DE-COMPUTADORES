export const breakFileIntoChunks = (file, chunkSize) => {
  const bufferChunks = [];

  for (let i = 0; i < file.length; i += chunkSize) {
    const content = file.subarray(i, i + chunkSize);

    bufferChunks.push(content);
  }

  return bufferChunks;
};
