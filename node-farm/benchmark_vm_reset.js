const vm = require('vm');
const fs = require('fs'); // Not strictly needed for this version, but kept from before
const path = require('path'); // Not strictly needed for this version, but kept from before

// The core logic, adapted to be run in a VM
// and expose the function via a property on the context's global object.
const toolLogicCode = `
    // console.log('vm_context: toolLogicCode executing');
    let callCount = 0; // This state is fresh for each new context
    function executeTool(input) {
        callCount++;
        // console.log(\`vm_context: callCount = \${callCount}, input: \${JSON.stringify(input)}\`);
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
    // Expose the functions directly as properties of the global context object
    // In the script's top-level scope, 'this' refers to the global object (the context).
    this.executeToolInVm = executeTool;
    this.getCallCountInVm = () => callCount;
`;

const inputData = { action: 'uppercase', payload: 'test vm' };

// --- Hyperfine measures the execution time of this entire script ---

// 1. Create a new VM context. This provides a fresh global scope.
const contextObject = {
    // console: console, // Example: if the script inside VM needs console
};
const context = vm.createContext(contextObject);

// 2. Run the tool's code within the new context.
// This compiles and executes the script, populating properties on 'context'.
vm.runInContext(toolLogicCode, context, { filename: 'mcp_tool_vm.js' }); // filename for stack traces

// 3. (Optional) Retrieve and execute the function to ensure it works.
// This part is included in the benchmarked time by hyperfine.
const executeToolFn = context.executeToolInVm;
if (executeToolFn) {
    const result = executeToolFn(inputData);
    // console.log('VM execution result:', result);
    // const count = context.getCallCountInVm();
    // console.log('VM call count:', count);
} else {
    // console.error('executeToolInVm not found in VM context');
    // This would cause an error if not found, but the script should define it.
    // To make it fail explicitly if not found for debugging:
    // throw new Error('executeToolInVm not found in VM context');
}

// --- Hyperfine measurement ends when this script exits ---
// console.log('benchmark_vm_reset.js finished');
