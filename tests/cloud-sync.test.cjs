const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const backupFunction = html.match(/async function cloudBackupSnapshot\(state=D\)\{[^\n]+/);
const saveFunction = html.match(/async function cloudSaveNow\(\)\{[^\n]+/);

test('repeated saves create one daily snapshot and keep syncing the latest state', async () => {
  assert.ok(backupFunction, 'cloudBackupSnapshot is present in index.html');
  assert.ok(saveFunction, 'cloudSaveNow is present in index.html');

  const snapshots = new Map();
  const calls = [];
  let savedState;
  const sb = {
    from(table) {
      return {
        upsert(row, options) {
          calls.push({ table, row, options });
          if (table === 'app_state_snapshots') {
            const key = `${row.user_id}:${row.snapshot_date}`;
            if (!snapshots.has(key)) snapshots.set(key, structuredClone(row.state));
          } else if (table === 'app_state') {
            savedState = structuredClone(row.state);
          }
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  const context = vm.createContext({
    sb,
    cloudUser: { id: 'test-user' },
    D: { movs: [{ t: 'venta', id: 1 }] },
    hoy: () => '2026-10-15',
    Date,
  });
  vm.runInContext(`${backupFunction[0]}\n${saveFunction[0]}`, context);

  await context.cloudSaveNow();
  context.D.movs.push({ t: 'gasto', id: 2 });
  await context.cloudSaveNow();

  assert.equal(snapshots.size, 1, 'only the first snapshot for the day is retained');
  assert.deepEqual([...snapshots.values()][0], { movs: [{ t: 'venta', id: 1 }] });
  assert.deepEqual(savedState, { movs: [{ t: 'venta', id: 1 }, { t: 'gasto', id: 2 }] });
  assert.equal(calls.filter(call => call.table === 'app_state_snapshots').length, 2);
  assert.ok(calls.filter(call => call.table === 'app_state_snapshots').every(call =>
    call.options.onConflict === 'user_id,snapshot_date' && call.options.ignoreDuplicates === true));
});

