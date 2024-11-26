import express from 'express';
import { createSkill, deleteSkill, getAllSkills } from '../controllers/skill.controller.js';

const router = express.Router();

router.post('/', createSkill);
router.get('/', getAllSkills);
router.delete('/:id', deleteSkill);

export default router;