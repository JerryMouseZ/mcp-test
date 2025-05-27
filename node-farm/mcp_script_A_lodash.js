// mcp_script_A_lodash.js
// Designed to run within isolated-vm.
// Assumes 'isEmpty' function (from lodash.isempty) is made available 
// in this script's scope when run in the isolate.

(function() { // IIFE to avoid redeclaration issues
    // console.log('mcp_script_A_lodash.js: Executing');
    const input = global.getSync('toolInput'); // Expected: { value: <data_to_check> }
    let resultValue;

    if (typeof isEmpty !== 'function') {
        // console.error('mcp_script_A_lodash.js: isEmpty function is not available!');
        resultValue = { error: 'isEmpty function not available in isolate' };
    } else if (!input || !input.hasOwnProperty('value')) {
        // console.error('mcp_script_A_lodash.js: Invalid input. Expected { value: ... }');
        resultValue = { error: 'Invalid input for lodash.isempty script. Expected { value: <data> }' };
    } else {
        try {
            const checkResult = isEmpty(input.value);
            // console.log('mcp_script_A_lodash.js: isEmpty result:', checkResult);
            resultValue = { result: checkResult };
        } catch (e) {
            // console.error('mcp_script_A_lodash.js: Error during isEmpty execution:', e);
            resultValue = { error: `Error during isEmpty execution: ${e.message}` };
        }
    }
    global.setSync('toolResult', resultValue);
})();
