const dns = require('dns').promises;

async function testSrvResolution() {
  try {
    console.log('Testing DNS SRV resolution for _mongodb._tcp.gymravana-cluster.apjmxs4.mongodb.net...');
    const result = await dns.resolveSrv('_mongodb._tcp.gymravana-cluster.apjmxs4.mongodb.net');
    console.log('SRV resolution successful:', result);
  } catch (error) {
    console.error('SRV resolution failed:', error);
    console.error('Error code:', error.code);
    console.error('Error syscall:', error.syscall);
  }
}

testSrvResolution();
