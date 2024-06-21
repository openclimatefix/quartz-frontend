async function fetchDataFromAPI() {
    // Authentication
    const client_id = "QLMdXCCHMS9Zl5W2tDG3otpdcY7GeEnJ";
    const username = "email"; //username
    const pwd = "password"; // password
    const domain = "nowcasting-pro.eu.auth0.com";
    const grant_type = "password";
  
    const authUrl = `https://${domain}/oauth/token`;
    const authHeader = { 'content-type': 'application/json' };
    const authData = JSON.stringify({
      "client_id": client_id,
      "username": username,
      "password": pwd,
      "grant_type": grant_type,
      "audience": "https://api.nowcasting.io/"
    });
  
    try {
      const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: authHeader,
        body: authData
      });
      const authDataJson = await authResponse.json();
      const accessToken = authDataJson.access_token;
  
      // Fetch data from API
      const apiUrl = "https://api.quartz.solar/v0/solar/GB/national/forecast?historic=true&";
      const apiHeader = {
        'Authorization': 'Bearer ' + accessToken
      };
      const apiResponse = await fetch(apiUrl, { headers: apiHeader });
      const apiData = await apiResponse.json();
  
      return apiData;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }
  
  export default fetchDataFromAPI;

  async function run() {
    try {
      const data = await fetchDataFromAPI();
      console.log(data);
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  run();
  