const http = require('http');

const PORT = 3000;
const MCP_TOOL_ENDPOINT = '/mcp_tool';

const server = http.createServer((req, res) => {
  if (req.url === MCP_TOOL_ENDPOINT && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { action, payload } = JSON.parse(body);
        let result;

        if (action === 'uppercase') {
          if (typeof payload === 'string') {
            result = payload.toUpperCase();
          } else {
            throw new Error('Invalid payload for uppercase action. Expected a string.');
          }
        } else if (action === 'sum') {
          if (Array.isArray(payload) && payload.every(num => typeof num === 'number')) {
            result = payload.reduce((acc, num) => acc + num, 0);
          } else {
            throw new Error('Invalid payload for sum action. Expected an array of numbers.');
          }
        } else {
          throw new Error(`Unknown action: ${action}`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(PORT, () => {
  console.log(`MCP HTTP Server listening on port ${PORT}`);
});

module.exports = server; // Export for potential testing
