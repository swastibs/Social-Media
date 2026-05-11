const passport = require("passport");

exports.authenticate = passport.authenticate("jwt", { session: false });
