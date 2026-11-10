import { shouldEncryptResponse, encryptAES } from './cryptoUtils.js';

export const successResponse = (res, data, message = 'Success', statusCode = 200) => {
  const req = res?.req;
  const isEncrypted = shouldEncryptResponse(req);

  const payload = {
    success: true,
    message,
    data,
  };

  if (isEncrypted) {
    return res.status(statusCode).json({
      isEncrypted: true,
      data: encryptAES(payload),
    });
  }

  return res.status(statusCode).json(payload);
};

export const errorResponse = (res, message = 'An error occurred', statusCode = 500, errors = null) => {
  const req = res?.req;
  const isEncrypted = shouldEncryptResponse(req);

  const payload = {
    success: false,
    message,
    errors,
  };

  if (isEncrypted) {
    return res.status(statusCode).json({
      isEncrypted: true,
      data: encryptAES(payload),
    });
  }

  return res.status(statusCode).json(payload);
};
