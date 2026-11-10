import CryptoJS from 'crypto-js';

// Default AES key matching backend default (passphrase compatible with CryptoJS OpenSSL format)
const DEFAULT_SECRET_KEY = 'inel_qtrack_aes_response_secret_key_2026';

/**
 * Safely retrieves environment variables across Vite runtime, Node.js test runners, and browsers.
 */
const getEnvVar = (key) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key] !== undefined) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }
  return undefined;
};

/**
 * Resolves the AES secret key from Vite environment or default fallback.
 */
export const getEncryptionKey = () => {
  return getEnvVar('VITE_RESPONSE_ENCRYPTION_KEY') || DEFAULT_SECRET_KEY;
};

/**
 * Checks whether the frontend application is running in production mode
 * (e.g. running from 'dist' folder / vite preview / production deployment)
 * or if encryption has been explicitly enabled for testing.
 */
export const isProductionMode = () => {
  const explicit = getEnvVar('VITE_ENCRYPT_RESPONSE');
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;

  const isProd = getEnvVar('PROD');
  const mode = getEnvVar('MODE');
  const nodeEnv = getEnvVar('NODE_ENV');

  return isProd === true || isProd === 'true' || mode === 'production' || nodeEnv === 'production';
};

/**
 * Encrypts an object or string using AES-256.
 */
export const encryptAES = (data, customKey = null) => {
  if (data === undefined || data === null) return data;
  const key = customKey || getEncryptionKey();
  try {
    const stringData = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.AES.encrypt(stringData, key).toString();
  } catch (error) {
    console.error('[Frontend AES Encryption Error]:', error);
    return data;
  }
};

/**
 * Decrypts an AES ciphertext string.
 * Returns parsed JSON object if possible, or plain string.
 */
export const decryptAES = (ciphertext, customKey = null) => {
  if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;
  const key = customKey || getEncryptionKey();
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedStr) {
      console.warn('[Frontend Crypto] Decrypted string is empty, falling back to raw ciphertext.');
      return ciphertext;
    }
    try {
      return JSON.parse(decryptedStr);
    } catch {
      return decryptedStr;
    }
  } catch (error) {
    console.error('[Frontend AES Decryption Error]:', error);
    return ciphertext;
  }
};

/**
 * Automatically inspects and decrypts API response data.
 * Supports:
 *  1. Full response body encryption: { isEncrypted: true, data: "..." }
 *  2. Inner data encryption: { success: true, message: "...", isEncrypted: true, data: "..." }
 *  3. Plain/Unencrypted data: returns data as-is with zero alteration.
 */
export const decryptResponseData = (responseData) => {
  if (!responseData || typeof responseData !== 'object') {
    return responseData;
  }

  // Check if response has encrypted payload marker
  if (responseData.isEncrypted && typeof responseData.data === 'string') {
    const decrypted = decryptAES(responseData.data);

    // If the decrypted content is the full response object envelope ({ success, message, data, ... })
    if (
      decrypted &&
      typeof decrypted === 'object' &&
      ('success' in decrypted || 'data' in decrypted || 'status' in decrypted || 'errors' in decrypted)
    ) {
      return decrypted;
    }

    // If only the inner data field was encrypted
    return {
      ...responseData,
      data: decrypted,
    };
  }

  // Handle case where error response errors field is encrypted
  if (responseData.isEncrypted && typeof responseData.errors === 'string') {
    return {
      ...responseData,
      errors: decryptAES(responseData.errors),
    };
  }

  return responseData;
};
