import loadMockData from './loadMockData.mjs'; // Import the loadMockData function from loadMockData.mjs
import fetchDataFromAPI from './fetchDataFromAPI.mjs'; // Import the fetchDataFromAPI function from fetchDataFromAPI.mjs

async function fetchData(filePath, useMockData) { // Accept filePath and useMockData as arguments
    if (!filePath) {
        throw new Error("A string representing the file path for data must be provided.");
    }

    if (useMockData) {
        console.log('Using mock data');
        try {
            const data = await loadMockData(filePath);
            console.log('Mock Data:', data); // Log the data
            return data;
        } catch (error) {
            console.error('Error fetching mock data:', error);
            throw new Error(`Error fetching mock data: ${error.message}`);
        }
    } else {
        console.log('Using data from API');
        try {
            const data = await fetchDataFromAPI(); // Call the fetchDataFromAPI function to fetch data from API
            console.log('API Data:', data); // Log the data
            return data;
        } catch (error) {
            console.error('Error fetching data from API:', error);
            throw new Error(`Error fetching data from API: ${error.message}`);
        }
    }
}

const filePath = "path"; // Define file path to mock data here
const useMockData = true; // Set to true to use mock data, false to fetch data from API

fetchData(filePath, useMockData); // Call the fetchData function with the file path and useMockData flag
