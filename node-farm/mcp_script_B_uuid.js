// mcp_script_B_uuid.js
// Designed to run within isolated-vm.
// Assumes 'uuidv4' function (from uuid package, specifically its v4 method) 
// is made available in this script's scope when run in the isolate.

(function() { // IIFE to avoid redeclaration issues
    // console.log('mcp_script_B_uuid.js: Executing');
    let resultValue;

    if (typeof uuidv4 !== 'function') {
        // console.error('mcp_script_B_uuid.js: uuidv4 function is not available!');
        resultValue = { error: 'uuidv4 function not available in isolate' };
    } else {
        try {
            const newUuid = uuidv4();
            // console.log('mcp_script_B_uuid.js: Generated UUID:', newUuid);
            resultValue = { result: newUuid };
        } catch (e) {
            // console.error('mcp_script_B_uuid.js: Error during uuidv4 execution:', e);
            resultValue = { error: `Error during uuidv4 execution: ${e.message}` };
        }
    }
    global.setSync('toolResult', resultValue);
})();
