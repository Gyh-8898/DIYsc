const apiBaseUrl = process.env.MINIAPP_API_BASE_URL || 'http://localhost:3001';

module.exports = {
  env: {
    API_BASE_URL: JSON.stringify(apiBaseUrl)
  },
  mini: {}
};
