async function downloadImage() {
    try {
      const folderPathInput = document.getElementById('folderPath');
      const folderPath = folderPathInput.value.trim(); // Get the folder path entered by the user
  
      if (!folderPath) {
        throw new Error('Please enter a folder path');
      }
  
      console.log('Folder path:', folderPath);
  
      // Example: Sending folder path to the server
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ folderPath })
      });
  
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
  
      const data = await response.json();
      console.log('Server response:', data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }
  
  