require("dotenv").config();

const bcrypt = require("bcrypt");
const cloudinary = require("cloudinary").v2;

// Handle both old and new versions of faker
let faker;

try {
  const { faker: newFaker } = require("@faker-js/faker");
  faker = newFaker;
} catch (e) {
  faker = require("faker");
}

const {
  sequelize,
  User,
  Post,
  Comment,
  PostLike,
  UserFollow,
} = require("../models");

/* =========================
   CLOUDINARY CONFIG
========================= */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* =========================
   CONFIG
========================= */

const CONFIG = {
  USERS: 10,
  POSTS_PER_USER: 10,
  COMMENTS_PER_POST: 5,
  LIKES_RATIO: 0.3,

  MIN_FOLLOWING: 3,
  MAX_FOLLOWING: 8,

  BATCH_SIZE: 100,
  CLOUDINARY_IMAGES_TO_UPLOAD: 50,
};

/* =========================
   HELPERS
========================= */

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const sampleBios = [
  "Tech enthusiast 🚀",
  "Coffee lover ☕",
  "Full-stack developer",
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
    if (faker?.internet?.username) {
      return faker.internet.username();
    }

    if (faker?.internet?.userName) {
      return faker.internet.userName();
    }

    if (faker?.person?.fullName) {
      return faker.person.fullName().replace(/\s/g, "").toLowerCase();
    }
  } catch (e) { }

  return `user${randomInt(1000, 9999)}`;
};

const generateRandomEmail = (name) => {
  try {
    if (faker?.internet?.email) {
      return faker.internet.email();
    }
  } catch (e) { }

  return `${name}${randomInt(1, 999)}@gmail.com`;
};

const getRandomBio = () =>
  sampleBios[Math.floor(Math.random() * sampleBios.length)];

const generatePostContent = () => {
  let content =
    postTemplates[Math.floor(Math.random() * postTemplates.length)];

  if (content.includes("{tech}")) {
    const tech = technologies[randomInt(0, technologies.length - 1)];
    content = content.replace("{tech}", tech);
  }

  return content;
};

const generateCommentContent = () => {
  return commentTemplates[randomInt(0, commentTemplates.length - 1)];
};

const getRandomDate = () => {
  const now = new Date();

  const daysAgo = randomInt(0, 30);

  const date = new Date(now);

  date.setDate(date.getDate() - daysAgo);

  return date;
};

/* =========================
   FETCH PICSUM IMAGES
========================= */

async function fetchPicsumImages() {
  console.log("📸 Fetching Picsum images...");

  const allImages = [];

  for (let page = 1; page <= 3; page++) {
    try {
      const response = await fetch(
        `https://picsum.photos/v2/list?page=${page}&limit=100`,
      );

      const images = await response.json();

      const urls = images.map((img) => img.download_url);

      allImages.push(...urls);

      console.log(`   Page ${page}: ${urls.length} images`);
    } catch (error) {
      console.log(`❌ Error page ${page}:`, error.message);
    }
  }

  console.log(`✅ Total fetched images: ${allImages.length}`);

  return allImages;
}

/* =========================
   CLOUDINARY UPLOAD
========================= */

async function uploadImageToCloudinary(imageUrl) {
  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: "postloop/posts",
      resource_type: "image",
    });

    return {
      imageUrl: result.secure_url,
      imagePublicId: result.public_id,
    };
  } catch (error) {
    console.log("❌ Cloudinary upload failed:", error.message);

    return null;
  }
}

/* =========================
   MAIN SEEDER
========================= */

const seed = async () => {
  let transaction;

  try {
    await sequelize.authenticate();

    console.log("✅ Database connected");

    /* =========================
       FETCH IMAGES
    ========================= */

    const picsumImages = await fetchPicsumImages();

    if (!picsumImages.length) {
      throw new Error("No images fetched");
    }

    /* =========================
       UPLOAD TO CLOUDINARY
    ========================= */

    console.log("\n☁️ Uploading images to Cloudinary...");

    const uploadedCloudinaryImages = [];

    const uploadLimit = Math.min(
      CONFIG.CLOUDINARY_IMAGES_TO_UPLOAD,
      picsumImages.length,
    );

    for (let i = 0; i < uploadLimit; i++) {
      const uploaded = await uploadImageToCloudinary(picsumImages[i]);

      if (uploaded?.imageUrl) {
        uploadedCloudinaryImages.push(uploaded);
      }

      console.log(
        `   Uploaded ${i + 1}/${uploadLimit} images to Cloudinary`,
      );
    }

    if (!uploadedCloudinaryImages.length) {
      throw new Error("No images uploaded to Cloudinary");
    }

    console.log(
      `✅ Uploaded ${uploadedCloudinaryImages.length} images successfully`,
    );

    /* =========================
       TRANSACTION
    ========================= */

    transaction = await sequelize.transaction();

    const hashedPassword = await bcrypt.hash("password123", 10);

    /* =========================
       USERS
    ========================= */

    console.log("\n👥 Creating users...");

    const userIds = [];

    const admin = await User.create(
      {
        name: "Admin User",
        email: "admin@postloop.com",
        password: hashedPassword,
        role: "admin",
        bio: "Platform administrator",
        profilePictureUrl: null,
        profilePicturePublicId: null,
        postsCount: 0,
        followersCount: 0,
        followingCount: 0,
        isActive: true,
        isDeleted: false,
      },
      { transaction },
    );

    userIds.push(admin.id);

    for (let i = 0; i < CONFIG.USERS; i++) {
      const name = generateRandomName();

      const user = await User.create(
        {
          name,
          email: generateRandomEmail(name),
          password: hashedPassword,
          role: "user",
          bio: Math.random() > 0.3 ? getRandomBio() : null,
          profilePictureUrl: null,
          profilePicturePublicId: null,
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

    console.log(`✅ Users created: ${userIds.length}`);

    /* =========================
       POSTS
    ========================= */

    console.log("\n📝 Creating posts...");

    const createdPosts = [];

    for (const userId of userIds) {
      for (let i = 0; i < CONFIG.POSTS_PER_USER; i++) {
        let imageUrl = null;
        let imagePublicId = null;

        if (Math.random() > 0.4) {
          const randomImage =
            uploadedCloudinaryImages[
            randomInt(0, uploadedCloudinaryImages.length - 1)
            ];

          imageUrl = randomImage.imageUrl;
          imagePublicId = randomImage.imagePublicId;
        }

        const post = await Post.create(
          {
            userId,
            content: generatePostContent(),
            imageUrl,
            imagePublicId,
            likeCount: 0,
            isDeleted: false,
            deletedBy: null,
            createdAt: getRandomDate(),
            updatedAt: new Date(),
          },
          { transaction },
        );

        createdPosts.push(post);

        console.log(`   Post created: ${post.id}`);
      }

      await User.update(
        {
          postsCount: CONFIG.POSTS_PER_USER,
        },
        {
          where: { id: userId },
          transaction,
        },
      );
    }

    console.log(`✅ Posts created: ${createdPosts.length}`);

    /* =========================
       COMMENTS
    ========================= */

    console.log("\n💬 Creating comments...");

    let totalComments = 0;

    for (const post of createdPosts) {
      const commentsCount = randomInt(1, CONFIG.COMMENTS_PER_POST);

      for (let i = 0; i < commentsCount; i++) {
        const randomUser =
          userIds[randomInt(0, userIds.length - 1)];

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

    /* =========================
       LIKES
    ========================= */

    console.log("\n❤️ Creating likes...");

    let totalLikes = 0;

    for (const post of createdPosts) {
      let postLikes = 0;

      for (const userId of userIds) {
        if (Math.random() < CONFIG.LIKES_RATIO) {
          try {
            await PostLike.create(
              {
                userId,
                postId: post.id,
                createdAt: getRandomDate(),
                updatedAt: new Date(),
              },
              { transaction },
            );

            postLikes++;
            totalLikes++;
          } catch (e) { }
        }
      }

      await Post.update(
        {
          likeCount: postLikes,
        },
        {
          where: { id: post.id },
          transaction,
        },
      );
    }

    console.log(`✅ Likes created: ${totalLikes}`);

    /* =========================
       FOLLOWS
    ========================= */

    console.log("\n🔗 Creating follows...");

    const followMap = new Set();

    for (const followerId of userIds) {
      const followCount = randomInt(
        CONFIG.MIN_FOLLOWING,
        CONFIG.MAX_FOLLOWING,
      );

      let current = 0;

      while (current < followCount) {
        const followingId =
          userIds[randomInt(0, userIds.length - 1)];

        if (followerId === followingId) continue;

        const key = `${followerId}-${followingId}`;

        if (followMap.has(key)) continue;

        followMap.add(key);

        await UserFollow.create(
          {
            followerId,
            followingId,
            createdAt: getRandomDate(),
            updatedAt: new Date(),
          },
          { transaction },
        );

        current++;
      }
    }

    console.log(`✅ Follows created: ${followMap.size}`);

    /* =========================
       UPDATE FOLLOW COUNTS
    ========================= */

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
        {
          followersCount,
          followingCount,
        },
        {
          where: { id: userId },
          transaction,
        },
      );
    }

    /* =========================
       COMMIT
    ========================= */

    await transaction.commit();

    console.log("\n🎉 SEEDING COMPLETED 🎉");

    console.log("\n📊 Stats:");
    console.log(`👥 Users: ${userIds.length}`);
    console.log(`📝 Posts: ${createdPosts.length}`);
    console.log(`💬 Comments: ${totalComments}`);
    console.log(`❤️ Likes: ${totalLikes}`);
    console.log(`🔗 Follows: ${followMap.size}`);
    console.log(
      `☁️ Cloudinary Images: ${uploadedCloudinaryImages.length}`,
    );

    console.log("\n🔑 Login:");
    console.log("Email: admin@postloop.com");
    console.log("Password: password123");

    process.exit(0);
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    console.error("\n❌ Seeder failed");
    console.error(error);

    process.exit(1);
  }
};

seed();