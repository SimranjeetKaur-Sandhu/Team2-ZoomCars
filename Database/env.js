const scopes = {
    withPassword: {
        attributes: {},
    }
};

const enums = {
    CarTypes: ['Sedan', 'SUV 5 Door', 'Minivan', 'Four Seater', 'Pickup', 'SUV 3 Door'],
    AccountStatus: { Pending: 'Pending', Confirmed: 'Confirmed', Blocked: 'Blocked' },
    BookingStatus: { Pending: 'Pending', Confirmed: 'Confirmed', Rejected: 'Rejected', Closed: 'Closed' },
    AccountType: ['Admin', 'User', 'Driver'],
    get AccountStatusValues() { return Object.values(this.AccountStatus)},
    get BookingStatusValues() { return Object.values(this.BookingStatus)},
    get AdminAccountType() { return this.AccountType[0] },
    get UserAccountType() { return this.AccountType[1] },
    get DriverAccountType() { return this.AccountType[2] }
};

module.exports = {
    scopes, enums
};