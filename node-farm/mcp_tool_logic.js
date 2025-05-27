// console.log('mcp_tool_logic.js: Loaded/Re-loaded');
let callCount = 0; // To demonstrate state if not reset properly

function executeTool(input) {
    callCount++;
    // console.log(`mcp_tool_logic.js: callCount = ${callCount}, input: ${JSON.stringify(input)}`);
    if (input.action === 'uppercase') {
        if (typeof input.payload === 'string') {
            return { result: input.payload.toUpperCase() };
        }
        return { error: 'Invalid payload for uppercase: expected string' };
    } else if (input.action === 'sum') {
        if (Array.isArray(input.payload) && input.payload.every(n => typeof n === 'number')) {
            return { result: input.payload.reduce((a, b) => a + b, 0) };
        }
        return { error: 'Invalid payload for sum: expected array of numbers' };
    }
    return { error: 'Unknown action' };
}

module.exports = { executeTool, getCallCount: () => callCount };
