const { sequelize, Sequelize } = require('./db');
const bcrypt = require('bcrypt');
const { enums } = require('./env');

//NOTE: Ensure sequelize instance is authenticated before defining models by calling initDb in db.js

//encryption methods
const encryptPassword = async (userWithPassword) => {
    if (!userWithPassword.password) throw { status: 500, message: "Cannot encrypt an empty password!" };
    const salt = await bcrypt.genSalt(10, 'a');
    const hashed = await bcrypt.hash(userWithPassword.password, salt);
    userWithPassword.password = hashed;
};

const validatePassword = async function (password) {
    if (!password) return false;
    return await bcrypt.compare(password, this.password);
};

//some utility objects
const defaultScope = {
    attributes: { exclude: ['password'] },
};

const withPassword = {
    attributes: { include: ['password'] }
}

const pkId = () => ({ type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true });
const string50nullable = () => ({ type: Sequelize.STRING(50) });
const string50 = () => ({ type: Sequelize.STRING(50), allowNull: false });

//MODELS
const Admin = sequelize.define("admin", {
    adminId: pkId(),
    username: { type: Sequelize.STRING(50), allowNull: false, unique: true },
    password: { type: Sequelize.STRING, allowNull: false },
}, {
    hooks: {
        beforeCreate: encryptPassword
    },
    defaultScope,
    scopes: { withPassword }
});
Admin.prototype.validatePassword = validatePassword;
Admin.prototype.getId = function () {
    return this.adminId;
};

const Area = sequelize.define("areas", {
    areaId: pkId(),
    areaName: string50()
}, { timestamps: false });

const Driver = sequelize.define("drivers", {
    driverId: pkId(),
    name: string50(),
    password: { type: Sequelize.STRING, allowNull: false },
    email: { ...string50(), unique: true },
    phoneNumber: { type: Sequelize.STRING(12), allowNull: false },
    dlNumber: string50(),
    profileImage: string50nullable(),
    // todo : profilePicture : {type : }
    carCapacity: { type: Sequelize.INTEGER, defaultValue: 1 },
    carType: { type: Sequelize.ENUM(enums.CarTypes), defaultValue: enums.CarTypes[0] },
    carModel: string50(),
    carColor: string50(),
    carImage: string50nullable(),
    carRegistrationNumber: string50(),
    insuranceValidUpto: { type: Sequelize.DATEONLY, allowNull: false },
    status: { type: Sequelize.ENUM(enums.AccountStatusValues), defaultValue: enums.AccountStatus.Pending },
}, {
    hooks: {
        beforeCreate: encryptPassword
    },
    defaultScope,
    scopes: { withPassword }
});
Driver.prototype.validatePassword = validatePassword;
Driver.prototype.getId = function () {
    return this.driverId;
};

const User = sequelize.define('users', {
    userId: pkId(),
    name: string50(),
    email: { ...string50(), unique: true },
    password: { type: Sequelize.STRING, allowNull: false },
    phoneNumber: { type: Sequelize.STRING(12), allowNull: false },
    status: { type: Sequelize.ENUM(enums.AccountStatusValues), defaultValue: enums.AccountStatus.Pending },
    profileImage: string50nullable(),
}, {
    hooks: {
        beforeCreate: encryptPassword
    },
    defaultScope,
    scopes: { withPassword }
});
User.prototype.validatePassword = validatePassword;
User.prototype.getId = function () {
    return this.userId;
};

const Booking = sequelize.define('bookings', {
    bookingId: pkId(),
    bookingDate: { type: Sequelize.DATEONLY },
    status: { type: Sequelize.ENUM(enums.BookingStatusValues), defaultValue: enums.BookingStatus.Pending },
    rating: { type: Sequelize.INTEGER, allowNull: true },
    bill: { type: Sequelize.INTEGER, allowNull: false }
});

const Route = sequelize.define('routes', {
    ratePerDay: { type: Sequelize.INTEGER, allowNull: false }
}, { timestamps: false });

//relations
User.belongsTo(Area, {foreignKey: 'areaId'});

Driver.hasMany(Route, { foreignKey: 'driverId', onDelete: 'CASCADE' });
Route.belongsTo(Driver, { foreignKey: 'driverId' });
Route.belongsTo(Area, { foreignKey: { name: 'sourceareaId', allowNull: false }, as: 'SourceArea' });
Route.belongsTo(Area, { foreignKey: { name: 'targetareaId', allowNull: false }, as: 'TargetArea' });

Driver.hasMany(Booking, { foreignKey: 'driverId' });
User.hasMany(Booking, { foreignKey: 'userId' });
Booking.belongsTo(Driver, { foreignKey: 'driverId' });
Booking.belongsTo(User, { foreignKey: 'userId' });
Booking.belongsTo(Area, { foreignKey: 'sourceareaId' });
Booking.belongsTo(Area, { foreignKey: 'targetareaId' });

const exported = {
    encryptPassword,
    Admin,
    User,
    Driver,
    Area,
    Booking,
    Route
};

module.exports = exported;