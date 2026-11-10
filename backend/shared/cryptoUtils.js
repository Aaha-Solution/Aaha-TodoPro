import CryptoJS from 'crypto-js';

// Default secret key for AES response encryption (256-bit compatible passphrase)
const DEFAULT_SECRET_KEY = 'inel_qtrack_aes_response_secret_key_2026';

/**
 * Resolves the AES secret key from environment or default fallback.
 */
export const getEncryptionKey = () => {
  return process.env.RESPONSE_ENCRYPTION_KEY || DEFAULT_SECRET_KEY;
};


export const shouldEncryptResponse = (req) => {
  if (process.env.ENCRYPT_RESPONSE === 'false') return false;
  if (process.env.ENCRYPT_RESPONSE === 'true') return true;
  if (process.env.NODE_ENV === 'production') return true;

  if (req && req.headers) {
    const clientEnv = req.headers['x-client-env'];
    const requestEncryption = req.headers['x-request-encryption'];
    if (clientEnv === 'production' || requestEncryption === 'true') {
      return true;
    }
  }

  return false;
};


export const encryptAES = (data, customKey = null) => {
  if (data === undefined || data === null) return null;
  const key = customKey || getEncryptionKey();
  try {
    const stringData = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.AES.encrypt(stringData, key).toString();
  } catch (error) {
    console.error('[AES Encryption Error]:', error.message);
    return data;
  }
};


export const decryptAES = (ciphertext, customKey = null) => {
  if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;
  const key = customKey || getEncryptionKey();
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedStr) return ciphertext;
    try {
      return JSON.parse(decryptedStr);
    } catch {
      return decryptedStr;
    }
  } catch (error) {
    console.error('[AES Decryption Error]:', error.message);
    return ciphertext;
  }
};

