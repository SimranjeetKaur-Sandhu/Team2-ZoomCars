const express = require('express');
const handlebars = require('express-handlebars');
const path = require('path');
const db = require('./db');
const cors = require('cors');
const session = require('express-session');
const sessionStore = require('session-file-store')(session);

//multer
const multer = require('multer');
const { randomInt } = require('crypto');
const { Area } = require('./models');
const { enums } = require('./env');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)) //Appending extension
    },
})
const upload = multer({ dest: 'public/uploads/', storage: storage });

const loadMockData = async (models) => {
    //todo :: dev only
    await models.Admin.findOrCreate({
        where: { username: 'admin' },
        defaults: { username: 'admin', password: 'password' }
    });
    const oldM = await Area.create({
        areaName: "Old Montreal"
    });
    const dt = await Area.create({
        areaName: "Downtown"
    });
    const ey = await Area.create({
        areaName: "East York"
    });
    const ny = await Area.create({
        areaName: "North York"
    });
    const et = await Area.create({
        areaName: "Etobicoke"
    });
    const user = await models.User.create({
        name: "John Doe",
        email: "John@Doe",
        password: "password",
        phoneNumber: "123-4564",
        status: enums.AccountStatus.Confirmed
    });
    user.setArea(oldM);
    const driver = await models.Driver.create({
        name: "John Doe",
        email: "John@Doe",
        password: "password",
        phoneNumber: "123-4567",
        dlNumber: "11DDDD22e3",
        carCapacity: 4,
        carType: 'Sedan',
        carModel: "Audi Something",
        carColor: "Black",
        carImage: "",
        carRegistrationNumber: "22BBBBLLLLL",
        insuranceValidUpto: new Date(),
        ratePerDay: 50,
        status: enums.AccountStatus.Confirmed
    });
    await models.Route.create({ sourceareaId: et.areaId, targetareaId: ny.areaId, ratePerDay: 5, driverId: driver.driverId });
    await models.Route.create({ sourceareaId: ny.areaId, targetareaId: et.areaId, ratePerDay: 15, driverId: driver.driverId });
    await models.Route.create({ sourceareaId: dt.areaId, targetareaId: oldM.areaId, ratePerDay: 12, driverId: driver.driverId });

    //only for bulk testing, don't uncomment
    // const drivers = [];
    // for (let i = 0; i < 10; i++) {
    //     const d = await models.Driver.create({
    //         name: "John Doe" + i,
    //         email: "John@Doe" + i,
    //         password: "password" + i,
    //         phoneNumber: "123-4567" + i,
    //         dlNumber: "11DDDD22e3" + i,
    //         carCapacity: 4 + i,
    //         carType: 'Sedan',
    //         carModel: "Audi Something" + i,
    //         carColor: "Black" + i,
    //         carImage: i % 5 + ".png",
    //         carRegistrationNumber: "22BBBBLLLLL" + i,
    //         insuranceValidUpto: new Date() + i * 10,
    //         ratePerDay: 50,
    //     });
    //     drivers.push(d);
    // }

    // for (let i = 0; i < 500; i++) {
    //     let date = new Date();
    //     date.setDate(date.getDate(date) + 1);
    //     await models.Booking.create({
    //         userId: user.userId,
    //         driverId: drivers[randomInt(drivers.length - 1)].driverId,
    //         bookingData: date,
    //         status: randomInt(5) > 3 ? "Closed" : "Pending"
    //     });
    // }
}

/**
 * Async for sequelize connection
 * @param {express.Express} app 
 */
const configureApp = async (app) => {
    //setup static to access css files
    app.use(express.static('public'));

    //for post bodies
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cors());

    app.use(session({ secret: '292j-dfas-2xssad', resave: true, saveUninitialized: true, store: new sessionStore({}) }));

    //setup handlebars
    const extname = 'hbs';
    app.set('view engine', extname);
    app.engine(extname, handlebars({
        layoutsDir: path.join(__dirname, 'views/layouts'),
        partialsDir: path.join(__dirname, 'views/partials'),
        extname: extname,
        defaultLayout: false,
        helpers: {
            ifEquals: function (arg1, arg2, options) {
                return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
            },
            unlessEquals: function (arg1, arg2, options) {
                return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
            },
            stringify: function (arg1) {
                return JSON.stringify(arg1);
            },
            ifElse: function (arg1, arg2) {
                if (arg1) return arg1;
                else return arg2;
            }
        }
    }));

    //setup sequelize
    await db.initDb();
    const models = require('./models');

    const force = true;
    await db.sequelize.sync({ logging: false, force });

    if (force) await loadMockData(models);
};

module.exports = {
    configureApp,
    multerUpload: upload
};