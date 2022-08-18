 export const breakFileIntoChunks = (file, chunkSize) => {
  const bufferChunks = [];

  try {
  for (let i = 0; i < file.length; i += chunkSize) {
    const content = file.subarray(i, i + chunkSize);

    bufferChunks.push(content);
  } 
} catch(error) {
  console.log("erro aqui tmb")
}

  return bufferChunks;
}; 