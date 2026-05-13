const express = require("express");
const router = express.Router();
const { validate } = require("express-validation");

const { redirectIfLoggedIn, isAuthenticated } = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/multer");
const { landing, loginForm, login, signupForm, signup, logout, changePasswordForm, changePassword } = require("../../controllers/web/auth.web");
const { webSignUpSchema, webLoginSchema, changePasswordSchema } = require("../../validations/web/auth.validation");
const { updateProfileSchema, userIdParamSchema } = require("../../validations/web/profile.validation");
const { renderFeed } = require("../../controllers/web/feed.web");
const { toggleFollow } = require("../../controllers/web/user.web");
const { renderProfile, renderFollowers, renderFollowing, renderEditProfile, updateProfile } = require("../../controllers/web/profile.web");
const { createPostForm, createPost, postDetail, editPostForm, updatePost, deletePost, toggleLike } = require("../../controllers/web/post.web");
const { createPostSchema, updatePostSchema, postIdParamSchema } = require("../../validations/web/post.validation");
const { createComment, updateComment, deleteComment, } = require("../../controllers/web/comment.web");
const { createCommentSchema, updateCommentSchema, commentIdParamSchema, } = require("../../validations/web/comment.validation");
const { searchPage } = require("../../controllers/web/search.web");


// ========== PUBLIC ROUTES ==========
router.get("/", redirectIfLoggedIn, landing);
router.get("/login", redirectIfLoggedIn, loginForm);
router.get("/signup", redirectIfLoggedIn, signupForm);
router.post("/logout", isAuthenticated, logout);

// ========== PROTECTED ROUTES (require login) ==========
// Static routes (must come before dynamic ones)
router.get("/change-password", isAuthenticated, changePasswordForm);
router.get("/feed", isAuthenticated, renderFeed);
router.get("/profile/edit", isAuthenticated, renderEditProfile);

// Dynamic routes with parameter validation
router.get("/profile/:userId", isAuthenticated, validate(userIdParamSchema), renderProfile);
router.get("/profile/:userId/followers", isAuthenticated, validate(userIdParamSchema), renderFollowers);
router.get("/profile/:userId/following", isAuthenticated, validate(userIdParamSchema), renderFollowing);

// POST routes
router.post("/login", validate(webLoginSchema), login);
router.post("/signup", upload.single("profilePicture"), validate(webSignUpSchema), signup);
router.post("/follow/:userId", isAuthenticated, validate(userIdParamSchema), toggleFollow);
router.post("/post/:postId/like", isAuthenticated, toggleLike);
router.post("/profile/edit", isAuthenticated, upload.single("profilePicture"), validate(updateProfileSchema), updateProfile);
router.post("/change-password", isAuthenticated, validate(changePasswordSchema), changePassword);

// POST routes (protected)
router.get("/post/create", isAuthenticated, createPostForm);
router.post("/post/create", isAuthenticated, upload.single("image"), validate(createPostSchema), createPost);
router.get("/post/:postId", isAuthenticated, validate(postIdParamSchema), postDetail);
router.get("/post/edit/:postId", isAuthenticated, validate(postIdParamSchema), editPostForm);
router.post("/post/edit/:postId", isAuthenticated, upload.single("image"), validate(updatePostSchema), updatePost);
router.post("/post/delete/:postId", isAuthenticated, validate(postIdParamSchema), deletePost);
router.post("/post/:postId/like", isAuthenticated, validate(postIdParamSchema), toggleLike);

// Comment routes (AJAX)
router.post("/comment/create", isAuthenticated, validate(createCommentSchema), createComment);
router.put("/comment/:commentId", isAuthenticated, validate(updateCommentSchema), updateComment);
router.delete("/comment/:commentId", isAuthenticated, validate(commentIdParamSchema), deleteComment);

router.get("/search", isAuthenticated, searchPage);

module.exports = router;

