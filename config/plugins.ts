export default ({ env }) => ({
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'smtp.protonmail.ch'),
        port: env.int('SMTP_PORT', 587),
        auth: {
          user: env('SMTP_USERNAME'),
          pass: env('SMTP_PASSWORD'),
        },
        // For SSL/TLS
        secure: env.bool('SMTP_SECURE', false), // true for 465, false for other ports
        // Optional: reject unauthorized certificates
        tls: {
          rejectUnauthorized: env.bool('SMTP_REJECT_UNAUTHORIZED', true),
        },
      },
      settings: {
        defaultFrom: env('SMTP_DEFAULT_FROM'),
        defaultReplyTo: env('SMTP_DEFAULT_REPLY_TO'),
      },
    },
  },
});
