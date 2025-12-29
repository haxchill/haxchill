#!/usr/bin/env node

const HaxballDatabase = require('../src/db/Database');

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node scripts/addAdmin.js <player_auth> <player_name> [role]');
  console.log('Example: node scripts/addAdmin.js "abc123def456" "AdminName" host');
  console.log('\nRole options: player, vip, admin, host (default: admin)');
  process.exit(1);
}

const [playerAuth, playerName, role = 'admin'] = args;

try {
  const db = new HaxballDatabase();
  
  // Check if player already exists
  const existing = db.getPlayerByAuth(playerAuth);
  
  if (existing) {
    console.log(`\n⚠️  Player already exists in database:`);
    console.log(`   Name: ${existing.name}`);
    console.log(`   Auth: ${existing.player_auth}`);
    console.log(`   Role: ${existing.role}`);
    console.log(`   Created: ${existing.created_at}`);
    
    if (existing.role !== role) {
      db.setPlayerRole(playerAuth, role);
      console.log(`\n✅ Role updated from "${existing.role}" to "${role}"`);
    } else {
      console.log(`\n✓ No changes needed`);
    }
  } else {
    db.upsertPlayer(playerAuth, playerName, role);
    console.log(`\n✅ Admin added successfully!`);
    console.log(`   Name: ${playerName}`);
    console.log(`   Auth: ${playerAuth}`);
    console.log(`   Role: ${role}`);
  }
  
  // Show all privileged (admin + host)
  console.log(`\n📋 Current admins/hosts in database:`);
  const admins = db.getPrivilegedPlayers();
  if (admins.length === 0) {
    console.log('   (none)');
  } else {
    admins.forEach((admin, i) => {
      console.log(`   ${i + 1}. ${admin.name} (${admin.player_auth}) [${admin.role}]`);
    });
  }
  
  db.close();
} catch (err) {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
}
