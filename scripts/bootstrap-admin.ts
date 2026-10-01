// One-off: create the very first accountType:'admin' account. Every admin account after this
// one is created through POST /auth/admin/accounts by an existing admin — that route is gated on
// ADMIN_USERS_MANAGE, which nobody holds until this script runs once. Reuses the exact same
// AccountRepository.create / hashPassword / defaultPermissionsFor('admin') path the API itself
// uses, so the bootstrapped account is indistinguishable from one created normally.
//
// Usage:
//   pnpm bootstrap:admin --email=you@example.com --password=... --first-name=Dev --last-name=Admin
//
// Reads MONGO_URL the same way the app does (.env in this directory), so run it against whatever
// environment should get the new admin — point MONGO_URL at production to bootstrap production,
// not local docker, if that's the one that needs it.
import { parseArgs } from 'node:util';
import { MongoClient } from 'mongodb';
import { loadEnv } from '../src/config/env.js';
import { AccountRepository } from '../src/modules/auth/index.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { defaultPermissionsFor } from '../src/modules/auth/service.js';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      password: { type: 'string' },
      'first-name': { type: 'string' },
      'last-name': { type: 'string' },
    },
  });

  const email = values.email;
  const password = values.password;
  const firstName = values['first-name'];
  const lastName = values['last-name'];

  if (!email || !password || !firstName || !lastName) {
    console.error(
      'Usage: pnpm bootstrap:admin --email=you@example.com --password=... --first-name=Dev --last-name=Admin',
    );
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error('--password must be at least 8 characters (same minimum the API enforces).');
    process.exitCode = 1;
    return;
  }

  const config = loadEnv();
  const client = new MongoClient(config.mongo.url);
  await client.connect();

  try {
    const accounts = new AccountRepository(client.db());
    await accounts.createIndexes();

    const existing = await accounts.findByEmailWithCredentials(email);
    if (existing) {
      console.error(`An account with email ${email} already exists (id ${existing.id}).`);
      process.exitCode = 1;
      return;
    }

    const passwordHash = await hashPassword(password);
    const account = await accounts.create({
      email,
      passwordHash,
      firstName,
      lastName,
      accountType: 'admin',
      permissions: defaultPermissionsFor('admin'),
    });

    console.log(`Created admin account ${account.id} (${account.email}).`);
    console.log(`Permissions: ${account.permissions.join(', ')}`);
    console.log('Log in via the normal POST /auth/login with this email/password.');
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
