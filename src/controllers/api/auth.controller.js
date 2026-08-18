const jwt = require("jsonwebtoken");
const { hash, compare } = require("bcrypt");

const { User } = require("../../models");
const { ROLES } = require("../../constant/role");
const { sanitizedUser } = require("../../utils/sanitizedUser");
const ApiError = require("../../utils/ApiError");
const { successResponse } = require("../../utils/ApiResponse");
const {
  storeToken,
  deleteToken,
  deleteAllUserTokens,
  removeTokenFromUser,
} = require("../../utils/authCache");
const { uploadToCloudinary } = require("../../utils/cloudinaryUpload");
const { invalidateUserCache } = require("../../utils/cache");

exports.signUp = async (req, res, next) => {
  try {
    const { name, email, password, bio } = req.body;
    const file = req.file;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) throw new ApiError(409, "Email already exists");

    const hashedPassword = await hash(password, 10);

    let profilePictureUrl = null;

    if (file) {
      const { url, thumbnailUrl } = await uploadToCloudinary(
        file.buffer,
        "profiles",
        { thumbnailSize: 80 },
      );
      profilePictureUrl = url;
    }

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      bio: bio || null,
      profilePictureUrl,
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
    });

    return successResponse(res, {
      statusCode: 201,
      message: "User created successfully",
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        profilePictureUrl: user.profilePictureUrl,
        postsCount: user.postsCount,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.logIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email, isDeleted: false },
    });

    if (!user) throw new ApiError(404, "User not exist");
    if (!user.isActive) throw new ApiError(403, "User is inactive");

    if (!user.password)
      throw new ApiError(
        401,
        "This account uses GitHub login. Please sign in with GitHub.",
      );

    const isPasswordMatch = await compare(password, user.password);
    if (!isPasswordMatch) throw new ApiError(401, "Invalid credentials");

    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    await storeToken(jwtToken, user.id);

    return successResponse(res, {
      message: "Login Success",
      data: {
        token: `Bearer ${jwtToken}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    const user = await User.findByPk(userId);
    if (!user) throw new ApiError(404, "User not found");

    const isMatch = await compare(oldPassword, user.password);
    if (!isMatch) throw new ApiError(401, "Old password is incorrect");

    const hashedPassword = await hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    await deleteAllUserTokens(userId);

    await invalidateUserCache(userId);

    return successResponse(res, {
      message: "Password changed successfully. Please login again.",
    });
  } catch (error) {
    next(error);
  }
};

exports.logOut = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = req.user?.id;

    if (token) {
      await deleteToken(token);
      if (userId) await removeTokenFromUser(userId, token);
    }

    return successResponse(res, { message: "Logout successful" });
  } catch (err) {
    next(err);
  }
};
