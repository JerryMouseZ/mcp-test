process.stdin.setEncoding('utf8');

let inputData = '';

process.stdin.on('readable', () => {
  let chunk;
  while ((chunk = process.stdin.read()) !== null) {
    inputData += chunk;
  }
});

process.stdin.on('end', () => {
  try {
    if (!inputData) {
      throw new Error('No input received on stdin.');
    }
    const { action, payload } = JSON.parse(inputData);
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

    process.stdout.write(JSON.stringify({ result }));
  } catch (error) {
    process.stderr.write(JSON.stringify({ error: error.message }));
    process.exit(1); // Exit with error code
  }
});
