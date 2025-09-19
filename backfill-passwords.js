// Script to backfill passwords for existing users migrating from OIDC auth
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { neon } from "@neondatabase/serverless";

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function backfillPasswords() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    // Get all users with null passwords
    const users = await sql`
      SELECT id, username, email FROM users WHERE password IS NULL
    `;
    
    console.log(`Found ${users.length} users without passwords`);
    
    for (const user of users) {
      // Create a temporary password: "welcome123" (users should reset this)
      const tempPassword = "welcome123";
      const hashedPassword = await hashPassword(tempPassword);
      
      await sql`
        UPDATE users 
        SET password = ${hashedPassword} 
        WHERE id = ${user.id}
      `;
      
      console.log(`Updated password for user: ${user.username} (${user.email})`);
    }
    
    console.log("✅ Password backfill complete!");
    console.log("🔔 All users have been assigned temporary password: 'welcome123'");
    console.log("💡 Users should change their password after first login");
    
  } catch (error) {
    console.error("❌ Error during password backfill:", error);
    process.exit(1);
  }
}

backfillPasswords();