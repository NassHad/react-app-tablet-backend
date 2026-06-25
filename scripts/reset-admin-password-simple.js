const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function resetAdminPassword(email, newPassword) {
  const dbPath = path.resolve(__dirname, '../.tmp/data.db');

  console.log(`\n🔐 Hashing password with bcrypt...`);

  // Hash the password with bcrypt (same as Strapi uses)
  // Strapi uses 10 rounds by default
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  console.log(`📂 Opening database: ${dbPath}`);

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Error opening database:', err.message);
      process.exit(1);
    }
  });

  // First, find the admin user
  db.get('SELECT * FROM admin_users WHERE email = ?', [email], async (err, row) => {
    if (err) {
      console.error('❌ Error querying database:', err.message);
      db.close();
      process.exit(1);
    }

    if (!row) {
      console.error(`\n❌ Admin user with email '${email}' not found`);
      console.error('Please check the email address and try again.\n');
      db.close();
      process.exit(1);
    }

    console.log(`✅ Found admin user: ${row.firstname} ${row.lastname}`);
    console.log(`💾 Updating password in database...`);

    // Update the password
    db.run(
      'UPDATE admin_users SET password = ? WHERE email = ?',
      [hashedPassword, email],
      function(err) {
        if (err) {
          console.error('❌ Error updating password:', err.message);
          db.close();
          process.exit(1);
        }

        console.log(`\n✅ Password successfully reset for ${email}`);
        console.log(`\nYou can now login with:`);
        console.log(`  Email: ${email}`);
        console.log(`  Password: [the password you just set]`);
        console.log(`\nAdmin panel: http://localhost:1338/admin\n`);

        db.close();
      }
    );
  });
}

// Parse command line arguments
const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: node scripts/reset-admin-password-simple.js <email> <password>');
  console.error('\nExample:');
  console.error("  node scripts/reset-admin-password-simple.js admin@example.com 'MyNewPassword123!'");
  console.error('\nNote: Quote the password if it contains special characters like *, &, $, etc.');
  process.exit(1);
}

resetAdminPassword(email, password);
