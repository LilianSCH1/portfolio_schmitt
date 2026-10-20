module.exports = {
  apps: [
    {
      name: 'portfolio',
      script: 'deploy/server.js',
      cwd: '/home/portfolio/app',
      env: { PORT: 3007, NODE_ENV: 'production' }
    }
  ]
};
