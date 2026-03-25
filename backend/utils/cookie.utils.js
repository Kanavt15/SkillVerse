const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS, 10) || 7;

/**
 * Get cookie options for refresh token
 * @returns {object} Cookie options for res.cookie()
 */
function getRefreshCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,                              // Prevents JavaScript access (XSS protection)
    secure: isProduction,                        // HTTPS only in production
    sameSite: isProduction ? 'strict' : 'lax',   // CSRF protection
    path: '/api/auth',                           // Only sent to auth routes
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000 // 7 days in ms
  };
}

/**
 * Get cookie options for clearing refresh token
 * @returns {object} Cookie options for res.clearCookie()
 */
function getClearCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/api/auth'
  };
}

module.exports = {
  getRefreshCookieOptions,
  getClearCookieOptions
};
