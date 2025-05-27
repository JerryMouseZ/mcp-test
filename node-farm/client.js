const http = require('http');
const { spawn } = require('child_process');
const { performance } = require('perf_hooks');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    options[key] = value;
  }
  if (!options.mode || !options.action || !options.payload) {
    console.error('Usage: node client.js --mode <stdio|http> --action <action_name> --payload <json_payload>');
    console.error('Example (stdio): node client.js --mode stdio --action uppercase --payload "hello"');
    console.error('Example (http): node client.js --mode http --action sum --payload "[3,5]"');
    process.exit(1);
  }
  try {
    // For actions like 'uppercase', the payload is a string and doesn't need JSON.parse.
    // For actions like 'sum', the payload is an array/object and needs JSON.parse.
    // We'll try to parse, and if it fails for a string, we'll use the raw string.
    try {
        options.payload = JSON.parse(options.payload);
    } catch (e) {
        // If JSON.parse fails, and it's a string payload for uppercase, it's fine.
        // Otherwise, it might be an issue for other actions expecting structured JSON.
        if (options.action !== 'uppercase' || typeof options.payload !== 'string') {
            // Re-throw if it's not the specific case we want to allow
            if (!(e instanceof SyntaxError && options.action === 'uppercase' && typeof options.payload === 'string')) {
                 console.warn(`Warning: Payload for action '${options.action}' could not be parsed as JSON. Using raw string: "${options.payload}". Error: ${e.message}`);
            }
        }
    }
  } catch (error) {
    console.error('Error parsing payload:', error.message);
    process.exit(1);
  }
  return options;
};

const executeStdio = (action, payload) => {
  const startTime = performance.now();
  const serverProcess = spawn('node', ['mcp_server_stdio.js']);

  let responseData = '';
  let errorData = '';

  serverProcess.stdout.on('data', (data) => {
    responseData += data.toString();
  });

  serverProcess.stderr.on('data', (data) => {
    errorData += data.toString();
  });

  serverProcess.on('close', (code) => {
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);

    if (errorData) {
      console.error(`STDIO Error: ${errorData}`);
    }
    if (responseData) {
      try {
        const result = JSON.parse(responseData);
        console.log('Result (stdio):', result);
      } catch (e) {
        console.error('Error parsing STDIO response JSON:', e.message);
        console.log('Raw STDIO response:', responseData);
      }
    }
    console.log(`Time taken (stdio): ${duration} ms`);
    if (code !== 0) {
      console.error(`STDIO process exited with code ${code}`);
    }
  });

  serverProcess.on('error', (err) => {
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);
    console.error('Failed to start STDIO process:', err);
    console.log(`Time taken (stdio): ${duration} ms`);
  });

  const requestPayload = JSON.stringify({ action, payload });
  serverProcess.stdin.write(requestPayload);
  serverProcess.stdin.end();
};

const executeHttp = (action, payload) => {
  const startTime = performance.now();
  const postData = JSON.stringify({ action, payload });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/mcp_tool',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const req = http.request(options, (res) => {
    let responseData = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    res.on('end', () => {
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      try {
        const result = JSON.parse(responseData);
        if (res.statusCode >= 400) {
            console.error(`HTTP Error ${res.statusCode}:`, result);
        } else {
            console.log('Result (http):', result);
        }
      } catch (e) {
        console.error('Error parsing HTTP response JSON:', e.message);
        console.log('Raw HTTP response:', responseData);
      }
      console.log(`Time taken (http): ${duration} ms`);
    });
  });

  req.on('error', (e) => {
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);
    console.error(`HTTP request error: ${e.message}`);
    console.log(`Time taken (http): ${duration} ms`);
  });

  req.write(postData);
  req.end();
};

const main = () => {
  const { mode, action, payload } = parseArgs();

  if (mode === 'stdio') {
    executeStdio(action, payload);
  } else if (mode === 'http') {
    executeHttp(action, payload);
  } else {
    console.error(`Invalid mode: ${mode}. Choose 'stdio' or 'http'.`);
    process.exit(1);
  }
};

main();
