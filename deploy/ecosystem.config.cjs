module.exports = {
  apps: [
    {
      name: 'crm-al-tokens-api',
      cwd: '/var/www/crm-al-tokens/apps/api',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
