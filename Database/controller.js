const express = require('express');
const Sequelize = require('sequelize');
const { enums } = require('./env');
const { encryptPassword, Admin, User, Driver, Area, Booking, Route } = require('./models');
const fs = require('fs');
const path = require('path');
const appDir = path.dirname(require.main.filename);
const uploadDir = path.join(appDir, 'public/uploads');

class Helper {
    static async getDefaultContext(req) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        let Tomorrow = tomorrow.toISOString();
        Tomorrow = Tomorrow.substring(0, Tomorrow.indexOf('T'));
        return {
            User: req.User,
            AccountType: req.session.AccountType,
            ...req.session.Body,
            ...req.body,
            ErrorMessages: Array.isArray(req.session.ErrorMessages) ? [...req.session.ErrorMessages] : [],
            Enums: enums,
            Tomorrow
        }
    };

    static async render(req, res, page, context = {}) {
        const defaultCtx = await this.getDefaultContext(req);
        const ctx = { ...context, ...defaultCtx };
        req.session.ErrorMessages = [];
        req.session.Body = {};
        if (context.ErrorMessages)
            ctx.ErrorMessages = ctx.ErrorMessages.concat(context.ErrorMessages);
        if (context.includeAreaList) {
            delete ctx.includeAreaList;
            const areas = (await Area.findAll()).map(a => a.dataValues);
            ctx.Areas = areas;
        }
        return res.render(page, ctx);
    }

    static confirmPassword = (body) => {
        if (!body.password || body.confirmPassword !== body.password) return false;
        return true;
    }

    static redirectHome(req, res) {
        res.redirect('/home');
    }

    static redirectDashboard(req, res) {
        res.redirect('/dashboard');
    }
}

class Controller {
    static async changePassword(req, res) {
        if (Helper.confirmPassword(req.body)) {
            const user = req.UserModel; //set by auth middleware
            if (user && user.validatePassword(req.body.oldPassword)) {
                await encryptPassword(req.body);
                user.password = req.body.password;
                await user.save();
                return Controller.logout(req, res);
            }
        }
        const messages = req.method === 'POST' ? ["Failed to confirm password."] : [];
        Helper.render(req, res, 'pages/change_password', { ErrorMessages: messages });
    }

    static async loginAdmin(req, res, next) {
        var messages = [];
        if (req.method === 'POST') {
            const admin = await Admin.scope('withPassword').findOne({ where: { username: req.body.username } });
            if (admin) {
                if (await admin.validatePassword(req.body.password)) {
                    req.session.AccountType = enums.AdminAccountType;
                    req.session.AccountId = admin.adminId;
                    Helper.redirectDashboard(req, res);
                    return;
                }
            }
            messages = ["Username or password is incorrect."];
        }
        Helper.render(req, res, 'pages/admin_login', { ErrorMessages: messages });
    }

    static async loginUser(req, res) {
        let messages = [];
        if (req.method === 'POST') {
            const user = await User.scope('withPassword').findOne({ where: { email: req.body.email } });
            if (user) {
                if (await user.validatePassword(req.body.password)) {
                    req.session.AccountType = enums.UserAccountType;
                    req.session.AccountId = user.userId;
                    Helper.redirectDashboard(req, res);
                    return;
                }
            }
            messages = ["Email or password is incorrect."];
        }
        Helper.render(req, res, 'pages/user_login', { ErrorMessages: messages });
    }

    static async loginDriver(req, res) {
        var messages = [];
        if (req.method === 'POST') {
            const driver = await Driver.scope('withPassword').findOne({ where: { email: req.body.email } });
            if (driver) {
                if (await driver.validatePassword(req.body.password)) {
                    req.session.AccountType = enums.DriverAccountType;
                    req.session.AccountId = driver.driverId;
                    Helper.redirectDashboard(req, res);
                    return;
                }
            }
            messages = ["Email or password is incorrect."];
        }
        Helper.render(req, res, 'pages/driver_login', { ErrorMessages: messages });
    }

    static async logout(req, res) {
        req.session?.destroy(() => Helper.redirectHome(req, res));
    }

    static async signupAdmin(req, res) {
        Admin.create(req.body).then((admin) => Controller.loginAdmin(req, res)).catch(next);
    }

    static signupDriver(req, res, next) {
        if (Helper.confirmPassword(req.body)) {
            Driver.create({ ...req.body, carImage: req.files.carImage.filename, profileImage: req.files.profileImage.filename }).then((driver) => Controller.loginDriver(req, res)).catch(next);
        } else {
            const messages = req.method === 'POST' ? ["Password confirmation failed."] : [];
            Helper.render(req, res, 'pages/driver_signup', { ErrorMessages: messages });
        }
    }

    static async signupUser(req, res, next) {
        if (Helper.confirmPassword(req.body)) {
            User.create({ ...req.body, profileImage: req.file.filename }).then((user) => {
                Controller.loginUser(req, res);
            }).catch(next);
        } else {
            const messages = req.method === 'POST' ? ["Password confirmation failed."] : [];
            Helper.render(req, res, 'pages/user_signup', { ErrorMessages: messages, includeAreaList: true });
        }
    }

    static async home(req, res) {
        let drivers = (await Driver.findAll({
            include: [{
                model: Route
            }, {
                model: Booking
            }]
        }));
        drivers = drivers.map(d => {
            const results = d.dataValues;
            results.ClosedBookingCount = d.bookings.reduce((accum, val) => {
                if (val.status == "Closed") accum++;
                return accum;
            }, 0);
            return results;
        });
        drivers = drivers.sort((d1, d2) => {
            return d2.ClosedBookingCount - d1.ClosedBookingCount;
        }).slice(0, 5);
        return Helper.render(req, res, 'pages/home', { Drivers: drivers });
    }

    static about(req, res) {
        return Helper.render(req, res, 'pages/about');
    }

    static blocked(req, res) {
        return Helper.render(req, res, 'pages/blocked');
    }

    static pending(req, res) {
        return Helper.render(req, res, 'pages/pending');
    }

    //based on logged in account type
    static async dashboard(req, res) {
        const acType = req.session?.AccountType;
        if (!acType || acType == enums.AdminAccountType) Helper.redirectHome(req, res);
        else {
            var page = 'pages/home';
            var context = {};
            if (acType !== enums.AdminAccountType) {
                context.Bookings = (await Booking.findAll({ where: { userId: req.UserModel.getId() }, include: [Driver, User] })).map(v => {
                    const results = v.dataValues;
                    results.user = results.user.dataValues;
                    results.driver = results.driver.dataValues;
                    return results;
                });
                if (acType === enums.UserAccountType) {
                    page = 'pages/user_dashboard';
                    context.Bookings = (await Booking.findAll({ where: { userId: req.UserModel.getId() }, include: Driver })).map(v => {
                        const results = v.dataValues;
                        results.driver = results.driver.dataValues;
                        return results;
                    });
                }
                else if (acType === enums.DriverAccountType) {
                    page = 'pages/driver_dashboard';
                }
            }
            Helper.render(req, res, page, context);
        }
    }

    static async profile(req, res) {
        const acType = req.session?.AccountType;
        if (!acType) Helper.redirectHome(req, res);
        if (acType === enums.UserAccountType) {
            if (req.method === 'POST') {
                const user = req.UserModel;
                for (const prop in req.body) {
                    if (!req.body[prop]) continue;
                    user.set(prop, req.body[prop]);
                }

                if (req.files?.profileImage?.length) {
                    const existingPath = path.join(uploadDir, user.profileImage || "");
                    if (fs.existsSync(existingPath) && fs.lstatSync(existingPath).isFile())
                        fs.unlinkSync(existingPath);
                    user.profileImage = req.files.profileImage[0].filename;
                }
                await user.save();
                req.User = user.dataValues;
            }
            Helper.render(req, res, 'pages/user_profile', {includeAreaList : true});
        } else if (acType === enums.DriverAccountType) {
            if (req.method === 'POST') {
                const driver = req.UserModel;
                console.log(req.body)
                for (const prop in req.body) {
                    if (!req.body[prop]) continue;
                    driver.set(prop, req.body[prop]);
                }

                if (req.files?.profileImage?.length) {
                    const existingPath = path.join(uploadDir, driver.profileImage || "");
                    if (fs.existsSync(existingPath) && fs.lstatSync(existingPath).isFile())
                        fs.unlinkSync(existingPath);
                    driver.profileImage = req.files.profileImage[0].filename;
                }
                if (req.files?.carImage?.length) {
                    const existingPath = path.join(uploadDir, driver.carImage || "");
                    if (fs.existsSync(existingPath) && fs.lstatSync(existingPath).isFile())
                        fs.unlinkSync(existingPath);
                    driver.carImage = req.files.carImage[0].filename;
                }
                await driver.save();
                req.User = driver.dataValues;
            }
            Helper.render(req, res, 'pages/driver_profile');
        }
        else {
            Helper.redirectDashboard(req, res);
        }
    }

    static async driverRoutes(req, res) {
        const driver = req.UserModel;
        const messages = [];
        if (req.method === 'POST') {
            if (req.body.addedArea && req.body.ratePerDay && req.body.sourceareaId && req.body.targetareaId) {
                if (await Route.findOne({
                    where: {
                        driverId: driver.driverId,
                        sourceareaId: req.body.sourceareaId,
                        targetareaId: req.body.targetareaId
                    }
                })) {
                    messages.push("Route already exists.");
                } else {
                    const queryBody = { ...req.body, driverId: driver.driverId };
                    await Route.create(queryBody);
                }
            } else if (req.body.deletedArea && req.body.sourceareaId && req.body.targetareaId) {
                await Route.destroy({
                    where: {
                        driverId: driver.driverId,
                        sourceareaId: req.body.sourceareaId,
                        targetareaId: req.body.targetareaId
                    }
                })
            } else {
                messages.push('Please fill the form correctly and ensure nothing is missing.');
            }
        }
        const routes = (await driver.getRoutes({ include: [{ model: Area, as: 'SourceArea' }, { model: Area, as: 'TargetArea' }] })).map(route => ({
            ...route.dataValues,
            SourceArea: route.SourceArea.dataValues,
            TargetArea: route.TargetArea.dataValues
        }));
        const uniqueSources = routes.map(route => route.SourceArea).filter((value, index, self) => self.findIndex((subValue) => subValue.areaId == value.areaId) === index);
        Helper.render(req, res, 'pages/driver_routes', { Driver: { ...driver.dataValues, Routes: routes, Sources: uniqueSources }, includeAreaList: true, ErrorMessages: messages });
    }

    static async adminViewDrivers(req, res, next) {
        if (req.body.newStatus) {
            const driver = await Driver.findByPk(req.body.accountId);
            driver.status = req.body.newStatus;
            await driver.save();
        }
        await Driver.findAll().then((drivers) => {
            Helper.render(req, res, 'pages/admin_view_drivers', { Drivers: drivers.map(d => d.dataValues) });
        }).catch(next);
    }

    static async adminViewUsers(req, res, next) {
        if (req.body.newStatus) {
            const user = await User.findByPk(req.body.accountId);
            user.status = req.body.newStatus;
            await user.save();
        }
        await User.findAll({ include: [{ model: Area }] }).then((users) => {
            Helper.render(req, res, 'pages/admin_view_users', {
                Users: users.map(u => {
                    const results = u.dataValues;
                    results.area = u.area?.dataValues;
                    return results;
                })
            });
        }).catch(next);
    }

    static adminManageAreas(req, res, next) {
        let promise = Promise.resolve();
        if (req.method === 'POST') {
            if (req.body.deletedArea) {
                promise = Area.destroy({ where: { areaId: req.body.areaId } });
            } else if (req.body.addedArea) {
                promise = Area.create(req.body);
            }
        }
        promise.then(() => Helper.render(req, res, 'pages/admin_manage_areas', { includeAreaList: true })).catch(next);
    }

    static async userSearchDrivers(req, res, next) {
        let drivers = [];
        if (req.body.date && req.body.sourceareaId && req.body.targetareaId) {
            drivers = (await Driver.findAll({
                include: [{
                    model: Route
                }, {
                    model: Booking
                }]
            }));
            const routeInRequest = route => route.sourceareaId == req.body.sourceareaId && route.targetareaId == req.body.targetareaId;
            drivers = drivers.filter(driver => {
                const isOfRoute = driver.routes.some(routeInRequest);
                if (isOfRoute) {
                    const bookings = driver.bookings.filter(booking => booking.bookingDate == req.body.date);
                    const isNotBookedByThisUser = bookings.every(booking => booking.userId != req.User.userId)
                    if (isNotBookedByThisUser) {
                        const customers = driver.bookings.reduce((accum, booking) => {
                            if (booking.status == enums.BookingStatus.Confirmed) {
                                return accum + 1;
                            }
                            return 0;
                        }, 0);
                        return customers < driver.carCapacity;
                    }
                    return isNotBookedByThisUser;
                }
                return isOfRoute;
            });
            drivers = drivers.map(d => {
                const results = d.dataValues;
                results.Route = d.routes.find(routeInRequest).dataValues;
                results.ClosedBookingCount = d.bookings.reduce((accum, val) => {
                    if (val.status == "Closed") accum++;
                    return accum;
                }, 0);
                return results;
            });
            console.log(drivers)
        }
        Helper.render(req, res, 'pages/user_search_drivers', { Drivers: drivers, FoundRides: (drivers && drivers.length > 0), includeAreaList: true });
    }

    static createBooking(req, res, next) {
        if (req.method === 'POST') {
            if (req.body.driverId && req.body.date) {
                const userId = req.UserModel.getId();
                return Booking.create({
                    bookingDate: req.body.date,
                    driverId: parseInt(req.body.driverId),
                    userId: userId,
                    sourceareaId: req.body.sourceareaId,
                    targetareaId: req.body.targetareaId,
                    bill: req.body.ratePerDay
                }).then((booking) => {
                    Helper.redirectDashboard(req, res);
                }).catch(next);
            }
        }
        Helper.redirectDashboard(req, res);
    }

    static changeBookingStatus(req, res, next) {
        if (req.method === 'POST') {
            if (req.body.bookingId && req.body.newStatus) {
                return Booking.update({ status: req.body.newStatus }, { where: { bookingId: req.body.bookingId } }).then(() => Helper.redirectDashboard(req, res)).catch(next);
            }
        }
        Helper.redirectDashboard(req, res);
    }

    static changeBookingRating(req, res, next) {
        if (req.method === 'POST') {
            if (req.body.bookingId && req.body.rating) {
                return Booking.update({ rating: req.body.rating }, { where: { bookingId: req.body.bookingId } }).then(() => Helper.redirectDashboard(req, res)).catch(next);
            }
        }
        Helper.redirectDashboard(req, res);
    }
}

module.exports = Controller;