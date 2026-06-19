// Register ts-node to handle TypeScript config files
const path = require('path');
require('ts-node').register({
  transpileOnly: true,
  project: path.resolve(__dirname, '../tsconfig.json'),
});

const { createStrapi } = require('@strapi/strapi');

async function resetAdminPassword(email, newPassword) {
  let strapi;

  try {
    console.log('\n🚀 Starting Strapi...');
    strapi = await createStrapi();
    await strapi.load();

    console.log(`🔄 Looking for admin user with email: ${email}`);

    // Find admin user by email
    const adminUser = await strapi
      .query('admin::user')
      .findOne({ where: { email } });

    if (!adminUser) {
      console.error(`\n❌ Admin user with email '${email}' not found`);
      console.error('Please check the email address and try again.\n');
      process.exit(1);
    }

    console.log(`✅ Found admin user: ${adminUser.firstname} ${adminUser.lastname}`);
    console.log(`🔐 Hashing new password...`);

    // Hash the new password using Strapi's admin auth service
    const hashedPassword = await strapi
      .service('admin::auth')
      .hashPassword(newPassword);

    console.log(`💾 Updating password in database...`);

    // Update the password
    await strapi
      .query('admin::user')
      .update({
        where: { id: adminUser.id },
        data: { password: hashedPassword }
      });

    console.log(`\n✅ Password successfully reset for ${email}`);
    console.log(`\nYou can now login with:`);
    console.log(`  Email: ${email}`);
    console.log(`  Password: [the password you just set]`);
    console.log(`\nAdmin panel: http://localhost:1338/admin\n`);

  } catch (error) {
    console.error('\n❌ Error resetting password:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    if (strapi) {
      await strapi.destroy();
    }
  }
}

// Parse command line arguments
const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: node scripts/reset-admin-password.js <email> <password>');
  console.error('\nExample:');
  console.error("  node scripts/reset-admin-password.js admin@example.com 'MyNewPassword123!'");
  console.error('\nNote: Quote the password if it contains special characters like *, &, $, etc.');
  process.exit(1);
}

resetAdminPassword(email, password);
