const ivm = require('isolated-vm');
console.log('isolated-vm loaded successfully');
const path = require('path');
console.log('node_modules path:', path.resolve(__dirname, 'node_modules'));
