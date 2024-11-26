import Skill from "../models/skill.js";


export const getAllSkills = async (req, res) => {
    try {
      const skills = await Skill.find();
      res.status(200).json(skills);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch skills' });
    }
  };
  
export const createSkill = async (req, res) => {
    try {
      const { name } = req.body;
      const newSkill = new Skill({ name });
      await newSkill.save();
      res.status(201).json(newSkill);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create skill' });
    }
  };
  
export const deleteSkill = async (req, res) => {
    try {
      const { id } = req.params;
      await Skill.findByIdAndDelete(id);
      res.status(200).json({ message: 'Skill deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete skill' });
    }
  };