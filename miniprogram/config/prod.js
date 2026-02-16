const apiBaseUrl = process.env.MINIAPP_API_BASE_URL || 'https://sc.y-98.cn';

module.exports = {
  env: {
    API_BASE_URL: JSON.stringify(apiBaseUrl)
  },
  mini: {}
};
