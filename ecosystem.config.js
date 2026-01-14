module.exports = {
  apps: [{
    name: 'tablet-app-backend',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/html/react-app-tablet-backend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 1338
    }
  }]
}
