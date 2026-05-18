const express = require("express");
const router = express.Router();
const { validate } = require("express-validation");

const { redirectIfLoggedIn, isAuthenticated, } = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/multer");
const webCacheMiddleware = require("../../middlewares/webCache.middleware");
const { invalidateCache, } = require("../../middlewares/invalidate.middleware");
const { landing, loginForm, login, signupForm, signup, logout, changePasswordForm, changePassword, } = require("../../controllers/web/auth.web");
const { webSignUpSchema, webLoginSchema, changePasswordSchema, } = require("../../validations/web/auth.validation");
const { updateProfileSchema, userIdParamSchema, } = require("../../validations/web/profile.validation");
const { renderFeed, } = require("../../controllers/web/feed.web");
const { toggleFollow, } = require("../../controllers/web/user.web");
const { renderProfile, renderFollowers, renderFollowing, renderEditProfile, updateProfile, } = require("../../controllers/web/profile.web");
const { createPostForm, createPost, postDetail, editPostForm, updatePost, deletePost, toggleLike, } = require("../../controllers/web/post.web");
const { createPostSchema, updatePostSchema, postIdParamSchema, } = require("../../validations/web/post.validation");
const { createComment, updateComment, deleteComment, } = require("../../controllers/web/comment.web");
const { createCommentSchema, updateCommentSchema, commentIdParamSchema, } = require("../../validations/web/comment.validation");
const { searchPage, } = require("../../controllers/web/search.web");


const invalidateWebCache = invalidateCache(["web:*"]);

router.get("/", redirectIfLoggedIn, landing);
router.get("/login", redirectIfLoggedIn, loginForm);
router.get("/signup", redirectIfLoggedIn, signupForm);

router.post("/login", validate(webLoginSchema), invalidateWebCache, login);
router.post("/signup", upload.single("profilePicture"), validate(webSignUpSchema), invalidateWebCache, signup);
router.post("/logout", isAuthenticated, invalidateWebCache, logout);


router.get("/change-password", isAuthenticated, changePasswordForm);
router.post("/change-password", isAuthenticated, validate(changePasswordSchema), invalidateWebCache, changePassword);

router.get("/feed", isAuthenticated, webCacheMiddleware(60 * 60), renderFeed);


router.get("/profile/edit", isAuthenticated, renderEditProfile);
router.post("/profile/edit", isAuthenticated, upload.single("profilePicture"), validate(updateProfileSchema), invalidateWebCache, updateProfile);
router.get("/profile/:userId", isAuthenticated, validate(userIdParamSchema), webCacheMiddleware(60 * 60 * 6), renderProfile);
router.get("/profile/:userId/followers", isAuthenticated, validate(userIdParamSchema), webCacheMiddleware(60 * 60 * 2), renderFollowers);
router.get("/profile/:userId/following", isAuthenticated, validate(userIdParamSchema), webCacheMiddleware(60 * 60 * 2), renderFollowing);
router.post("/follow/:userId", isAuthenticated, validate(userIdParamSchema), invalidateWebCache, toggleFollow);

router.get("/post/create", isAuthenticated, createPostForm);
router.post("/post/create", isAuthenticated, upload.single("image"), validate(createPostSchema), invalidateWebCache, createPost);
router.get("/post/:postId", isAuthenticated, validate(postIdParamSchema), webCacheMiddleware(60 * 60 * 6), postDetail);
router.get("/post/edit/:postId", isAuthenticated, validate(postIdParamSchema), editPostForm);
router.post("/post/edit/:postId", isAuthenticated, upload.single("image"), validate(updatePostSchema), invalidateWebCache, updatePost);
router.post("/post/delete/:postId", isAuthenticated, validate(postIdParamSchema), invalidateWebCache, deletePost);
router.post("/post/:postId/like", isAuthenticated, validate(postIdParamSchema), invalidateWebCache, toggleLike);

router.post("/comment/create", isAuthenticated, validate(createCommentSchema), invalidateWebCache, createComment);
router.put("/comment/:commentId", isAuthenticated, validate(updateCommentSchema), invalidateWebCache, updateComment);
router.delete("/comment/:commentId", isAuthenticated, validate(commentIdParamSchema), invalidateWebCache, deleteComment);

router.get("/search", isAuthenticated, webCacheMiddleware(60 * 30), searchPage);

module.exports = router;