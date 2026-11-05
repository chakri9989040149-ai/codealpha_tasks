const express = require('express');
const router = express.Router();
const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  inviteMember,
  removeMember,
  addColumn,
  updateColumn,
  deleteColumn,
} = require('../controllers/projectController');
const { protect, isProjectMember, isProjectOwner } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getProjects)
  .post(createProject);

router.route('/:id')
  .get(isProjectMember, getProject)
  .put(isProjectMember, updateProject)
  .delete(isProjectMember, isProjectOwner, deleteProject);

router.post('/:id/members', isProjectMember, isProjectOwner, inviteMember);
router.delete('/:id/members/:userId', isProjectMember, isProjectOwner, removeMember);

router.post('/:id/columns', isProjectMember, addColumn);
router.put('/:id/columns/:columnId', isProjectMember, updateColumn);
router.delete('/:id/columns/:columnId', isProjectMember, deleteColumn);

module.exports = router;
