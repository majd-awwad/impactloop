export const sanitizeSmtpError = (message: string): string => {
  return message
    .replace(/(password|passwd|auth)[^\s]*/gi, '[redacted]')
    .replace(/\b[A-Za-z0-9]{16,}\b/g, (token) =>
      token.includes('@') ? token : '[redacted]',
    )
    .trim();
};
