const { UserFollow, User } = require("../../models");
const { sequelize } = require("../../models");

exports.toggleFollow = async (req, res, next) => {
  try {
    const followerId = req.user.id;
    const followingId = parseInt(req.params.userId);
    if (followerId === followingId)
      return res.status(400).json({ error: "Cannot follow yourself" });

    const existing = await UserFollow.findOne({
      where: { followerId, followingId },
    });

    if (existing) {
      await existing.destroy();
      await User.decrement("followingCount", {
        by: 1,
        where: { id: followerId },
      });
      await User.decrement("followersCount", {
        by: 1,
        where: { id: followingId },
      });
      return res.json({ following: false });
    } else {
      await UserFollow.create({ followerId, followingId });
      await User.increment("followingCount", {
        by: 1,
        where: { id: followerId },
      });
      await User.increment("followersCount", {
        by: 1,
        where: { id: followingId },
      });
      return res.json({ following: true });
    }
  } catch (err) {
    next(err);
  }
};
