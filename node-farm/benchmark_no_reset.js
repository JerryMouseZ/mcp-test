const path = require('path');

const modulePath = path.resolve(__dirname, './mcp_tool_logic.js');
const inputData = { action: 'uppercase', payload: 'test' }; // Example data

// For Hyperfine, each execution of this script is a new process.
// So, require.cache will be empty at the start of each script run unless
// we are doing multiple reloads *within* this single script execution.
// The goal here is to measure the time taken to:
// 1. Check and delete the module from cache (if it were populated by a previous require in the same process).
// 2. Re-require (load) the module.

// In a real server, the first require() would populate the cache.
// Subsequent "resets" would delete and re-require.
// Hyperfine runs this script N times as separate processes.
// To simulate the "delete then require" part accurately for measurement,
// we can first require it, then delete it, then measure the time to require it again.
// However, the simplest interpretation for Hyperfine is to measure the cost of
// "delete (if exists) + require".

let startTime;

// Simulate a scenario where the module *might* have been loaded before in the same process.
// For Hyperfine, this `if` block will likely not find modulePath in cache on the first pass
// of a *single script execution* because it's a new process each time.
// But if this script were part of a larger, long-running process, this check would be relevant.
if (require.cache[modulePath]) {
    // console.log('Module was in cache, deleting...');
    delete require.cache[modulePath];
}

// Start timing the reload (or initial load if cache was empty)
startTime = process.hrtime.bigint();

const toolModule = require(modulePath);

// Optional: execute the function to ensure it's working and include its overhead
// For this benchmark, we are primarily interested in the reload mechanism itself.
// toolModule.executeTool(inputData); 

const endTime = process.hrtime.bigint();

// This script doesn't need to output the time itself for Hyperfine,
// as Hyperfine measures the total execution time of this script.
// The operations within this script (delete from cache + require) ARE the work being measured.
// console.log(`Overhead time: ${(endTime - startTime) / 1000000n} ms`); // For manual check

// To verify state across reloads (not applicable for hyperfine's multi-process runs,
// but for manual testing):
// const currentCallCount = toolModule.getCallCount ? toolModule.getCallCount() : -1;
// console.log(`Call count: ${currentCallCount}`);
