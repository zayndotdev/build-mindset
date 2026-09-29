import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

function check(p: string) {
  if (!fs.existsSync(p)) {
    console.log(p, 'DOES NOT EXIST');
    return;
  }
  const db = new DatabaseSync(p);
  try {
    const creds = db.prepare('SELECT * FROM credential').all();
    console.log(p, 'Credentials count:', creds.length, creds);
  } catch (e: any) {
    console.log(p, 'Error:', e.message);
  }
}

check('data/mindset.db');
check('apps/api/data/mindset.db');
