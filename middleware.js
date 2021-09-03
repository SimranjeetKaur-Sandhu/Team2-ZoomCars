const express = require('express');
const { User, Admin, Driver } = require('./models');
const { enums } = require('./env');
const { Sequelize, sequelize } = require('./db');
const multer = require('multer');

/**
 * 
 * @param {express.Request} req 
 * @param {express.Response} res 
 * @returns {Promise<User>}
 */
const getLoggedInUser = (accountType, accountId) => {
    switch (accountType) {
        case enums.UserAccountType:
            return User.scope('withPassword').findByPk(accountId);
        case enums.AdminAccountType:
            return Admin.scope('withPassword').findByPk(accountId);
        case enums.DriverAccountType:
            return Driver.scope('withPassword').findByPk(accountId);
        default:
            throw { status: 404, message: 'Unknown account type: ' + accountType };
    }
}

function validateUserAndReturn(req, res, next) {
    return getLoggedInUser(req.session?.AccountType, req.session?.AccountId).then((user) => {
        if (user.status) {
            if (user.status == enums.AccountStatus.Pending) {
                req.session.destroy();
                return next({ redirect: 'pending' });
            } else if (user.status == enums.AccountStatus.Blocked) {
                req.session.destroy();
                return next({ redirect: 'blocked' });
            }
        }
        req.UserModel = user;
        req.User = user.dataValues;
        next();
    }).catch(next);
}

/**
 * @returns {function(express.Request, express.Response, express.NextFunction) : void}
 */
function auth(accountTypes, dontFail = false) {
    function authenticator(req, res, next) {
        if (!Array.isArray(accountTypes)) accountTypes = [accountTypes];
        if (accountTypes.includes(req.session?.AccountType)) {
            return validateUserAndReturn(req, res, next);
        } else {
            if (dontFail)
                return next('route');
            else
                throw { status: 404 };
        }
    }
    return authenticator;
};

function loggedIn() {
    return function checksAccountType(req, res, next) {
        if (req.session?.AccountType) {
            return validateUserAndReturn(req, res, next);
        } else {
            return res.redirect('/home');
        }
    }
}

function notLoggedIn() {
    return function checksAccountType(req, res, next) {
        if (req.session?.AccountType) req.session.destroy();
        next();
    };
}

function errorHandler() {
    /**
     * @param {express.Response} res
     */
    return (error, req, res, next) => {
        if (res.headersSent) {
            return next(error);
        }
        var errorMessages = [];
        try {
            if (error instanceof multer.MulterError) {
                errorMessages.push("Failed to upload file.");
            }
            else if (error instanceof Sequelize.ValidationError) {
                errorMessages = errorMessages.concat(error.errors.map(validErrorItem => {
                    if (validErrorItem.validatorKey === 'not_unique') {
                        return `${validErrorItem.path.substring(validErrorItem.path.lastIndexOf('.') + 1).toUpperCase()} already exists!`
                    }
                    return validErrorItem.message.substring(validErrorItem.message.indexOf('.') + 1);
                }));
                return res.redirect(req.url);
            }
            else if (error.reload) {
                errorMessages = [...errorMessages, (error.messages || [])];
                return res.redirect(req.url);
            } else if (error.redirect) {
                errorMessages = [...errorMessages, (error.messages || [])];
                return res.redirect(error.redirect);
            }
            switch (error.status) {
                case 400:
                    res.status(401).render('pages/401error');
                    break;
                case 404:
                    res.status(404).render('pages/404error');
                    break;
                default:
                    console.log(error);
                    res.status(500).render('pages/500error');
                    break;
            }
        } finally {
            //persist body in session for autofill
            if (req.session) {
                req.session.Body = req.body;
                req.session.ErrorMessages = errorMessages;
                if (req.session.Body?.password) delete req.session.Body.password;
                if (req.session.Body?.confirmPassword) delete req.session.Body.confirmPassword;
            }
        }

    };
}

module.exports = {
    auth,
    errorHandler,
    notLoggedIn,
    loggedIn
};