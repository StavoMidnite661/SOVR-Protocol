import { TigerBeetleDriver } from './packages/runtime/dist/adapters/tigerbeetle/TigerBeetleDriver.js';

function safeStringify(obj) {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

const driver = new TigerBeetleDriver({
  clusterId: 0,
  addresses: ['127.0.0.1:3000', '127.0.0.1:3001', '127.0.0.1:3002'],
  concurrencyMax: 32,
});

console.log('Connecting to TigerBeetle via SOVR protocol driver...');

try {
  await driver.connect();
  const health = await driver.healthCheck();
  console.log('TigerBeetle health:', safeStringify(health));

  const createResult = await driver.createAccount({
    sovrId: 'test-account-001',
    ledger: 'VAULT',
    code: 'ASSET',
    flags: { debitsMustNotExceedCredits: true },
  });

  console.log('Account creation result:', safeStringify(createResult));

  const balance = await driver.getBalance('test-account-001');
  console.log('Account balance:', safeStringify(balance));

  await driver.disconnect();
  console.log('✅ SOVR TigerBeetleDriver connection verified');
} catch (err) {
  console.error('❌ TigerBeetle connection failed:', err);
  process.exit(1);
}
