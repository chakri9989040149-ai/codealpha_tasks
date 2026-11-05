const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Project = require('../models/Project');

// Verify Bearer JWT
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route, token missing',
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'supersecret_jwt_codealpha_boards_key_2026_x!'
    );
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

// Ensure user is member or owner of the project
const isProjectMember = async (req, res, next) => {
  try {
    const projectId =
      req.params.projectId ||
      req.params.id ||
      req.body.projectId ||
      req.query.projectId;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required',
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    const userIdStr = req.user._id.toString();
    const isOwner = project.owner.toString() === userIdStr;
    const memberObj = project.members.find(
      (m) => m.user && (m.user._id ? m.user._id.toString() : m.user.toString()) === userIdStr
    );

    if (!isOwner && !memberObj) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this project',
      });
    }

    req.project = project;
    req.userRole = isOwner ? 'owner' : (memberObj ? memberObj.role : 'member');
    next();
  } catch (err) {
    next(err);
  }
};

// Ensure user is owner of the project
const isProjectOwner = (req, res, next) => {
  if (req.userRole !== 'owner') {
    return res.status(403).json({
      success: false,
      message: 'Action restricted to project owner only',
    });
  }
  next();
};

module.exports = {
  protect,
  isProjectMember,
  isProjectOwner,
};
