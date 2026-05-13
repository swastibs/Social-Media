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
} = require("../../utils/authCache");
const cloudinary = require("../../config/cloudinary");
const { uploadToCloudinary } = require("../../utils/cloudinaryUpload");

// SIGN UP
exports.signUp = async (req, res, next) => {
  try {
    const { name, email, password, bio } = req.body;
    const file = req.file;

    const existingUser = await User.findOne({ where: { email } });

    if (existingUser) throw new ApiError(409, "Email already exists");

    const hashedPassword = await hash(password, 10);

    let profilePictureUrl = null;
    let profilePicturePublicId = null;

    if (file) {
      const uploaded = await uploadToCloudinary(file, "postloop/profiles");

      profilePictureUrl = uploaded.secure_url;
      profilePicturePublicId = uploaded.public_id;
    }

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      bio: bio || null,
      profilePictureUrl,
      profilePicturePublicId,
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

// LOGIN
exports.logIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email, isDeleted: false },
    });

    if (!user) throw new ApiError(404, "User not exist");
    if (!user.isActive) throw new ApiError(403, "User is inactive");

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

// CHANGE PASSWORD
exports.changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Verify old password
    const isMatch = await compare(oldPassword, user.password);
    if (!isMatch) {
      throw new ApiError(401, "Old password is incorrect");
    }

    // Hash and update new password
    const hashedPassword = await hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    await deleteAllUserTokens(userId);

    return successResponse(res, {
      message: "Password changed successfully. Please login again.",
    });
  } catch (error) {
    next(error);
  }
};

// LOGOUT
exports.logOut = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const userId = req.user?.id;

    if (token) {
      await deleteToken(token);
      await exports.removeTokenFromUser?.(userId, token);
    }

    return successResponse(res, {
      message: "Logout successful",
    });
  } catch (err) {
    next(err);
  }
};
