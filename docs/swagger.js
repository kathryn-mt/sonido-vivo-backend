const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi.json');

function register(app) {
    app.use(
        '/api/docs',
        swaggerUi.serve,
        swaggerUi.setup(openapi, {
            customSiteTitle: 'Sonido Vivo API',
            swaggerOptions: {
                supportedSubmitMethods: ['get', 'post', 'put', 'patch', 'delete'],
                tryItOutEnabled: true
            }
        })
    );
}

module.exports = {
    openapi: openapi,
    register: register
};
