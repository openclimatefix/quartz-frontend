import { readFile } from 'fs/promises'; // Import the readFile function from fs/promises

/// load mock data

async function loadMockData(filePath) {
    if (!filePath) {
        throw new Error("A string representing the file path for mock data must be provided.");
    }
    try {
        const data = await readFile(filePath, 'utf-8'); // Read the file asynchronously
        return JSON.parse(data); // Parse the JSON data
    } catch (error) {
        throw new Error(`Error loading mock data from file: ${error.message}`); 
    }
}

export default loadMockData; // Export the loadMockData function

