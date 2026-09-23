import multer from 'multer';

// Use memoryStorage so file buffers are kept in RAM and saved directly into MySQL database as LONGBLOB binary
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

