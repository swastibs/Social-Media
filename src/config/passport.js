/**
 * Passport Configuration (Authentication)
 *
 * Configures Passport.js with JWT and GitHub OAuth strategies.
 * JWT is used for cookie‑based authentication, GitHub for social login.
 */

const passport = require("passport");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const GitHubStrategy = require("passport-github2").Strategy;
const { isTokenValid } = require("../utils/authCache");
const { User } = require("../models");
const bcrypt = require("bcrypt");

// ----- JWT STRATEGY -----
// Extract token from cookie (httpOnly) or Authorization header
const cookieExtractor = (req) => {
  let token = null;
  if (req && req.cookies) token = req.cookies.postloop_token;
  return token;
};

const opts = {
  jwtFromRequest: ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(),
    cookieExtractor,
  ]),
  secretOrKey: process.env.JWT_SECRET,
  passReqToCallback: true,
};

passport.use(
  new JwtStrategy(opts, async (req, jwt_payload, done) => {
    try {
      const token =
        ExtractJwt.fromAuthHeaderAsBearerToken()(req) ||
        req.cookies.postloop_token;
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

// ----- GITHUB OAUTH STRATEGY -----
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL,
      scope: ["user:email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ where: { githubId: profile.id } });

        if (!user && profile.emails && profile.emails[0]) {
          const email = profile.emails[0].value;
          user = await User.findOne({ where: { email, isDeleted: false } });
          if (user) {
            user.githubId = profile.id;
            await user.save();
          }
        }

        if (!user) {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(
              new Error(
                "GitHub account has no public email. Please set a public email in GitHub settings.",
              ),
            );
          }

          const name =
            profile.displayName || profile.username || email.split("@")[0];

          user = await User.create({
            name: name,
            email: email,
            password: null,
            githubId: profile.id,
            profilePictureUrl: profile.photos?.[0]?.value || null,
            bio: null,
            isActive: true,
            isDeleted: false,
            role: "user",
            postsCount: 0,
            followersCount: 0,
            followingCount: 0,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);

// ----- SERIALIZATION (required for sessions with OAuth) -----
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user || false);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
