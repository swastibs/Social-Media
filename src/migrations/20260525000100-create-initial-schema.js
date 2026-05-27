"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const existingTables = (await queryInterface.showAllTables()).map(
      (table) =>
        typeof table === "string" ? table : table.tableName || table.table_name,
    );
    const hasTable = (tableName) => existingTables.includes(tableName);
    const ensureTable = async (tableName, columns) => {
      if (hasTable(tableName)) return;
      await queryInterface.createTable(tableName, columns);
      existingTables.push(tableName);
    };
    const ensureIndex = async (tableName, fields, options = {}) => {
      if (!hasTable(tableName)) return;
      const indexName = options.name || `idx_${tableName}_${fields.join("_")}`;
      const indexes = await queryInterface.showIndex(tableName);
      const exists = indexes.some((index) => {
        const indexFields = (index.fields || []).map(
          (field) => field.attribute || field.name,
        );
        return (
          index.name === indexName ||
          fields.every((field) => indexFields.includes(field))
        );
      });
      if (!exists)
        await queryInterface.addIndex(tableName, fields, {
          ...options,
          name: indexName,
        });
    };

    await ensureTable("users", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      bio: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      isPrivate: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isVerified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      githubId: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      },
      profilePictureUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      thumbnailUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      postsCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      role: {
        type: Sequelize.ENUM("user", "admin"),
        defaultValue: "user",
      },
      followersCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      followingCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      resetPasswordToken: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      resetPasswordExpires: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      isDeleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      deletedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await ensureTable("posts", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      imageUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      thumbnailUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      likeCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      isDeleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      deletedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await ensureTable("comments", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      postId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "posts", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      isDeleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      deletedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await ensureTable("post_likes", {
      userId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      postId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: { model: "posts", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await ensureTable("user_follows", {
      followerId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      followingId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      status: {
        type: Sequelize.ENUM("pending", "accepted", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await ensureTable("payments", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      razorpayOrderId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      razorpayPaymentId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      razorpaySignature: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "Amount in paise",
      },
      currency: {
        type: Sequelize.STRING,
        defaultValue: "INR",
      },
      status: {
        type: Sequelize.ENUM("created", "attempted", "paid", "failed"),
        defaultValue: "created",
      },
      paymentMethod: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      paymentDetails: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Store JSON response from Razorpay",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await ensureIndex("users", ["name"]);
    await ensureIndex("users", ["isDeleted", "isActive"]);
    await ensureIndex("users", ["createdAt"]);
    await ensureIndex("users", ["followersCount"]);
    await ensureIndex("users", ["followingCount"]);
    await ensureIndex("users", ["role", "isActive", "isDeleted", "id"]);

    await ensureIndex("posts", ["likeCount"]);
    await ensureIndex("posts", ["isDeleted"]);
    await ensureIndex("posts", ["createdAt"]);
    await ensureIndex("posts", ["userId", "createdAt"]);
    await ensureIndex("posts", ["userId", "isDeleted"]);
    await ensureIndex("posts", ["isDeleted", "createdAt", "userId"]);

    await ensureIndex("comments", ["userId"]);
    await ensureIndex("comments", ["postId"]);
    await ensureIndex("comments", ["isDeleted"]);
    await ensureIndex("comments", ["createdAt"]);
    await ensureIndex("comments", ["postId", "isDeleted"]);

    await ensureIndex("post_likes", ["postId"]);
    await ensureIndex("user_follows", ["followerId"]);
    await ensureIndex("user_follows", ["followerId", "status"]);
    await ensureIndex("user_follows", ["followingId"]);
    await ensureIndex("payments", ["userId"]);
    await ensureIndex("payments", ["razorpayOrderId"]);
    await ensureIndex("payments", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("payments");
    await queryInterface.dropTable("user_follows");
    await queryInterface.dropTable("post_likes");
    await queryInterface.dropTable("comments");
    await queryInterface.dropTable("posts");
    await queryInterface.dropTable("users");
  },
};
