export default () => ({
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD,
        },
        // Uncomment if using TLS
        // secure: false,
        // tls: {
        //   rejectUnauthorized: false
        // }
      },
      settings: {
        defaultFrom: process.env.SMTP_DEFAULT_FROM || 'noreply@example.com',
        defaultReplyTo: process.env.SMTP_DEFAULT_REPLY_TO || 'noreply@example.com',
      },
    },
  },
});
