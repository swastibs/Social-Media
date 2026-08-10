require("dotenv").config();

const bcrypt = require("bcrypt");
const { faker } = require("@faker-js/faker");
const {
  sequelize,
  User,
  Post,
  Comment,
  PostLike,
  UserFollow,
} = require("../models");
const { ROLES } = require("../constant/role");
const flushAuthCache = require("../utils/flushAuthCache");

/* =========================
   CONFIG
========================= */

const CONFIG = {
  ADMIN_EMAIL: "admin@gmail.com",
  ADMIN_NAME: "Admin",
  REGULAR_USERS: 100,
  POSTS_PER_USER: 5,
  COMMENTS_PER_POST: 10,
  LIKES_RATIO: 0.5,
  MIN_FOLLOWING: 10,
  MAX_FOLLOWING: 50,
  PROFILE_IMAGES_TO_UPLOAD: 100,
  POST_IMAGES_TO_UPLOAD: 250,
};

/* =========================
   HELPERS
========================= */

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const sampleBios = [
  "Tech enthusiast 🚀",
  "Coffee lover ☕",
  "Full‑stack developer",
  "Dreamer ✨",
  "JavaScript lover ❤️",
  "Backend engineer",
  "UI/UX designer",
  "Open source contributor",
];

const technologies = [
  "React",
  "Node.js",
  "MongoDB",
  "Redis",
  "Docker",
  "AWS",
  "Next.js",
  "TypeScript",
];

const postTemplates = [
  "Just finished building a new feature! 🚀",
  "Anyone else love working with {tech}?",
  "Weekend coding session was 🔥",
  "Coffee and coding ☕",
  "Learning something new every day 💪",
  "Working on something exciting ✨",
];

const commentTemplates = [
  "Great post 👏",
  "Amazing 🔥",
  "Thanks for sharing",
  "Love this ❤️",
  "Very useful 🙌",
  "Awesome work 🚀",
];

const generateRandomName = () => {
  try {
    return faker.internet.username();
  } catch {
    return (
      faker.person?.fullName?.()?.replace(/\s/g, "").toLowerCase() ||
      `user${randomInt(1000, 9999)}`
    );
  }
};

const generateRandomEmail = (name, index) =>
  `${name}${index}${Date.now()}@gmail.com`;

const getRandomBio = () => sampleBios[randomInt(0, sampleBios.length - 1)];

const generatePostContent = () => {
  let content = postTemplates[randomInt(0, postTemplates.length - 1)];
  if (content.includes("{tech}"))
    content = content.replace(
      "{tech}",
      technologies[randomInt(0, technologies.length - 1)],
    );

  return content;
};

const generateCommentContent = () =>
  commentTemplates[randomInt(0, commentTemplates.length - 1)];

const getRandomDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, 30));
  return date;
};

/* =========================
   FETCH PICSIM IMAGES
========================= */

async function fetchPicsumImages(limit) {
  console.log(`📸 Fetching ${limit} Picsum image URLs...`);
  const allUrls = [];
  let page = 1;
  while (allUrls.length < limit) {
    const res = await fetch(
      `https://picsum.photos/v2/list?page=${page}&limit=100`,
    );
    const data = await res.json();
    const urls = data.map((img) => img.download_url);
    allUrls.push(...urls);
    console.log(
      `   Page ${page}: ${urls.length} images (total ${allUrls.length})`,
    );
    page++;
    if (page > 10) break;
  }
  const result = allUrls.slice(0, limit);
  console.log(`✅ Total fetched URLs: ${result.length}`);
  return result;
}

/* =========================
   MAIN SEEDER
========================= */

const seed = async () => {
  let transaction;

  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // ----- CLEAN DATABASE -----
    console.log("\n🧹 Cleaning database...");
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
    await UserFollow.destroy({ where: {}, truncate: true, force: true });
    await PostLike.destroy({ where: {}, truncate: true, force: true });
    await Comment.destroy({ where: {}, truncate: true, force: true });
    await Post.destroy({ where: {}, truncate: true, force: true });
    await User.destroy({ where: {}, truncate: true, force: true });
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("✅ Database cleaned");

    // 👇 CRITICAL: Invalidate all existing sessions
    await flushAuthCache();

    // ----- FETCH PROFILE IMAGES -----
    const profileImageUrls = await fetchPicsumImages(
      CONFIG.PROFILE_IMAGES_TO_UPLOAD,
    );
    if (!profileImageUrls.length) throw new Error("No profile images fetched");

    const uploadedProfileUrls = profileImageUrls;
    console.log(`✅ Using ${uploadedProfileUrls.length} profile image URLs`);

    // ----- FETCH POST IMAGES -----
    const uploadedPostUrls = await fetchPicsumImages(CONFIG.POST_IMAGES_TO_UPLOAD);
    if (!uploadedPostUrls.length) throw new Error("No post images fetched");
    console.log(`✅ Using ${uploadedPostUrls.length} post image URLs`);

    // ----- TRANSACTION -----
    transaction = await sequelize.transaction();

    const hashedPassword = await bcrypt.hash("9898", 10);
    const userIds = [];

    // ----- CREATE ADMIN -----
    console.log("\n👑 Creating admin user...");
    const adminProfilePic = uploadedProfileUrls[0];
    const admin = await User.create(
      {
        name: CONFIG.ADMIN_NAME,
        email: CONFIG.ADMIN_EMAIL,
        password: hashedPassword,
        role: ROLES.ADMIN,
        bio: "System Administrator",
        profilePictureUrl: adminProfilePic,
        postsCount: 0,
        followersCount: 0,
        followingCount: 0,
        isActive: true,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { transaction },
    );
    userIds.push(admin.id);
    console.log(`   Admin created: ${admin.name} (${admin.email})`);

    // ----- CREATE REGULAR USERS -----
    console.log("\n👥 Creating regular users...");
    for (let i = 0; i < CONFIG.REGULAR_USERS; i++) {
      const name = generateRandomName();
      const profilePicUrl =
        uploadedProfileUrls[i + 1] || uploadedProfileUrls[0];
      const user = await User.create(
        {
          name,
          email: generateRandomEmail(name, i),
          password: hashedPassword,
          role: ROLES.USER,
          bio: Math.random() > 0.3 ? getRandomBio() : null,
          profilePictureUrl: profilePicUrl,
          postsCount: 0,
          followersCount: 0,
          followingCount: 0,
          isActive: true,
          isDeleted: false,
          createdAt: getRandomDate(),
          updatedAt: new Date(),
        },
        { transaction },
      );
      userIds.push(user.id);
      console.log(`   User created: ${user.name}`);
    }
    console.log(`✅ Total users: ${userIds.length}`);

    // ----- POSTS -----
    console.log("\n📝 Creating posts (alternating image)...");
    const createdPosts = [];
    for (const userId of userIds) {
      for (let i = 0; i < CONFIG.POSTS_PER_USER; i++) {
        let imageUrl = null;
        if (i % 2 === 0)
          imageUrl =
            uploadedPostUrls[randomInt(0, uploadedPostUrls.length - 1)];

        const post = await Post.create(
          {
            userId,
            content: generatePostContent(),
            imageUrl,
            likeCount: 0,
            isDeleted: false,
            deletedBy: null,
            createdAt: getRandomDate(),
            updatedAt: new Date(),
          },
          { transaction },
        );
        createdPosts.push(post);
      }
      await User.update(
        { postsCount: CONFIG.POSTS_PER_USER },
        { where: { id: userId }, transaction },
      );
    }
    console.log(`✅ Posts created: ${createdPosts.length}`);

    // ----- COMMENTS -----
    console.log("\n💬 Creating comments...");
    let totalComments = 0;
    for (const post of createdPosts) {
      const commentsCount = randomInt(1, CONFIG.COMMENTS_PER_POST);
      for (let i = 0; i < commentsCount; i++) {
        const randomUser = userIds[randomInt(0, userIds.length - 1)];
        await Comment.create(
          {
            postId: post.id,
            userId: randomUser,
            content: generateCommentContent(),
            isDeleted: false,
            deletedBy: null,
            createdAt: getRandomDate(),
            updatedAt: new Date(),
          },
          { transaction },
        );
        totalComments++;
      }
    }
    console.log(`✅ Comments created: ${totalComments}`);

    // ----- LIKES -----
    console.log("\n❤️ Creating likes...");
    let totalLikes = 0;
    for (const post of createdPosts) {
      let postLikes = 0;
      for (const userId of userIds) {
        if (Math.random() < CONFIG.LIKES_RATIO)
          try {
            await PostLike.create({ userId, postId: post.id }, { transaction });
            postLikes++;
            totalLikes++;
          } catch (e) {}
      }
      await Post.update(
        { likeCount: postLikes },
        { where: { id: post.id }, transaction },
      );
    }
    console.log(`✅ Likes created: ${totalLikes}`);

    // ----- FOLLOWS -----
    console.log("\n🔗 Creating follows...");
    const followMap = new Set();
    for (const followerId of userIds) {
      const followCount = randomInt(CONFIG.MIN_FOLLOWING, CONFIG.MAX_FOLLOWING);
      let current = 0;
      while (current < followCount) {
        const followingId = userIds[randomInt(0, userIds.length - 1)];
        if (followerId === followingId) continue;
        const key = `${followerId}-${followingId}`;
        if (followMap.has(key)) continue;
        followMap.add(key);
        await UserFollow.create({ followerId, followingId }, { transaction });
        current++;
      }
    }
    console.log(`✅ Follows created: ${followMap.size}`);

    // ----- UPDATE FOLLOW COUNTS -----
    console.log("\n📊 Updating follow counts...");
    for (const userId of userIds) {
      const followersCount = await UserFollow.count({
        where: { followingId: userId },
        transaction,
      });
      const followingCount = await UserFollow.count({
        where: { followerId: userId },
        transaction,
      });
      await User.update(
        { followersCount, followingCount },
        { where: { id: userId }, transaction },
      );
    }

    // ----- COMMIT -----
    await transaction.commit();

    console.log("\n🎉 SEEDING COMPLETED 🎉");
    console.log("\n📊 Stats:");
    console.log(
      `👥 Users: ${userIds.length} (1 admin, ${CONFIG.REGULAR_USERS} regular)`,
    );
    console.log(
      `📝 Posts: ${createdPosts.length} (50% with images, alternating)`,
    );
    console.log(`💬 Comments: ${totalComments}`);
    console.log(`❤️ Likes: ${totalLikes}`);
    console.log(`🔗 Follows: ${followMap.size}`);
    console.log(`🖼️ Profile images: ${uploadedProfileUrls.length}`);
    console.log(`🖼️ Post images: ${uploadedPostUrls.length}`);
    console.log("\n🔑 Login credentials (all users):");
    console.log("Admin: admin@gmail.com / 9898");
    console.log("Regular user: any generated email / 9898");
    process.exit(0);
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("\n❌ Seeder failed:", error);
    process.exit(1);
  }
};

seed();
