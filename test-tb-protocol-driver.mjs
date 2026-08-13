import { TigerBeetleTransportClient } from './packages/runtime/dist/ledger/tigerbeetle/tigerbeetle-transport.js';

console.log('Sole TigerBeetle integration boundary: packages/runtime/src/ledger/tigerbeetle');
const client = new TigerBeetleTransportClient({
  tigerbeetleBinaryPath: process.env.TIGERBEETLE_BINARY ?? 'tigerbeetle',
  clusterFile: process.env.TIGERBEETLE_CLUSTER_FILE ?? './data/tigerbeetle/0_0.tigerbeetle',
  dataDirectory: process.env.TIGERBEETLE_DATA_DIR ?? './data/tigerbeetle',
  port: Number(process.env.TIGERBEETLE_PORT ?? 8080),
  readOnly: true,
  writeEnabled: false,
});
console.log('Transport constructed (no connect, no write). writeEnabled=', client.isWriteEnabled());
