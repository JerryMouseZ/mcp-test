// mcp_tool_logic_for_isolate.js (IIFE Wrapped)
// Executed within an isolated-vm Isolate.

(function() {
    // console.log('isolated-vm: mcp_tool_logic_for_isolate.js (IIFE) executing');

    const input = global.getSync('toolInput'); // Retrieve input set by the host
    let resultValue;

    if (!input) {
        resultValue = { error: 'No input provided via global.toolInput' };
    } else if (input.action === 'uppercase') {
        if (typeof input.payload === 'string') {
            resultValue = input.payload.toUpperCase();
        } else {
            resultValue = { error: 'Invalid payload for uppercase: expected string' };
        }
    } else if (input.action === 'sum') {
        if (Array.isArray(input.payload) && input.payload.every(n => typeof n === 'number')) {
            resultValue = input.payload.reduce((a, b) => a + b, 0);
        } else {
            resultValue = { error: 'Invalid payload for sum: expected array of numbers' };
        }
    } else {
        resultValue = { error: 'Unknown action' };
    }

    // Set the result for the host to retrieve
    global.setSync('toolResult', resultValue);
    // console.log('isolated-vm: mcp_tool_logic_for_isolate.js (IIFE) result set:', JSON.stringify(resultValue));
})();
