const express = require('express');
const Controller = require('./controller');
const { auth, errorHandler, notLoggedIn, loggedIn } = require('./middleware');
const { enums } = require('./env');

/**
 * The application is in a configured and connected state at this point.
 * @param {express.Express} app 
 */
async function initRoutes(app, multerUpload) {
    //common to all
    app.get('/', Controller.home);
    app.get('/home', Controller.home);
    app.get('/about', Controller.about);
    app.get('/blocked', notLoggedIn(), Controller.blocked);
    app.get('/pending', notLoggedIn(), Controller.pending);
    app.get('/dashboard', loggedIn(), Controller.dashboard);
    app.all('/profile', loggedIn(), multerUpload.fields([{ name: 'profileImage', maxCount: 1 }, { name: 'carImage', maxCount: 1 }]), Controller.profile);
    app.all('/change-password', loggedIn(), Controller.changePassword);

    //session
    app.all('/admin-login', notLoggedIn(), Controller.loginAdmin);
    app.all('/user-login', notLoggedIn(), Controller.loginUser);
    app.all('/driver-login', notLoggedIn(), Controller.loginDriver);
    app.get('/logout', Controller.logout);

    //account
    app.all('/driver-routes', auth(enums.DriverAccountType), Controller.driverRoutes)
    app.all('/user-signup', notLoggedIn(), multerUpload.single('profileImage'), Controller.signupUser);
    app.all('/driver-signup', notLoggedIn(), multerUpload.fields([{ name: 'profileImage', maxCount: 1 }, { name: 'carImage', maxCount: 1 }]), Controller.signupDriver);

    app.all('/admin-view-drivers', auth(enums.AdminAccountType), Controller.adminViewDrivers);
    app.all('/admin-view-users', auth(enums.AdminAccountType), Controller.adminViewUsers);
    app.all('/admin-manage-areas', auth(enums.AdminAccountType), Controller.adminManageAreas);

    app.all('/user-search-drivers', auth(enums.UserAccountType), Controller.userSearchDrivers);
    app.post('/make-booking', auth(enums.UserAccountType), Controller.createBooking);
    app.post('/update-booking', loggedIn(), Controller.changeBookingStatus);
    app.post('/rate-booking', auth(enums.UserAccountType), Controller.changeBookingRating);

    app.use(errorHandler());
};

module.exports = initRoutes;