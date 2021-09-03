const express = require('express');
const app = express();

(async () => {
    const {configureApp, multerUpload} = require('./configuration');
    await configureApp(app);
    
    const routeInitiator = require('./routes');
    await routeInitiator(app, multerUpload);
    
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`App listening on port ${port}`));
})();