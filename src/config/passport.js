const passport = require("passport");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const { isTokenValid } = require("../utils/authCache");

const { User } = require("../models");

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
  passReqToCallback: true,
};

passport.use(
  new JwtStrategy(opts, async (req, jwt_payload, done) => {
    try {
      const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

      const isValid = await isTokenValid(token);

      if (!isValid) return done(null, false);

      const user = await User.findByPk(jwt_payload.userId);

      if (!user || user.isDeleted || !user.isActive) return done(null, false);

      return done(null, user);
    } catch (error) {
      return done(error, false);
    }
  }),
);
