const Sequelize = require('sequelize');

const config = {
    HOST: "localhost",
    USER: "root",
    PASSWORD: "",
    DB: "driver",
    dialect: "mysql",
};

const sequelize = new Sequelize.Sequelize(config.DB, config.USER, config.PASSWORD, {
    host: config.HOST,
    dialect: config.dialect
});
let authenticated = false;

const initDb = async () => {
    if (!authenticated) {
        try {
            const result = await sequelize.authenticate();
            authenticated = true;
            console.log('Connection has been established');
        }
        catch (err) {
            throw 'EXITING! Unable to connect to the database:' + err;
        }
    }
};

const db = {
    initDb: initDb,
    Sequelize: Sequelize,
    sequelize: sequelize
};

module.exports = db;