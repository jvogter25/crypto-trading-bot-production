const express = require('express');
const app = express();
const port = process.env.PORT || 8000;

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Test Deployment</title>
</head>
<body>
    <h1>🚀 NEW DEPLOYMENT WORKING!</h1>
    <p>Time: ${new Date().toISOString()}</p>
    <p>This confirms the new code is deployed.</p>
</body>
</html>
  `);
});

app.listen(port, () => {
  console.log(`Test server running on port ${port}`);
});