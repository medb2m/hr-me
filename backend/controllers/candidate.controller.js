import Candidate from "../models/candidate.js";

// create New Candidate
export const createCandidate = async (req, res) => {
    try {
        const candidate = new Candidate(req.body);
        await candidate.save();
        res.status(201).json(candidate);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
}

// Get all candidates
export const getAllCandidates = async (req, res) => {
    try {
      const candidates = await Candidate.find();
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
}

// Get a specific candidate
export const getCandidateById = async (req, res) => {
    try {
      const candidate = await Candidate.findById(req.params.id);
      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }
      res.json(candidate);
    } catch (error) {
      res.status(404).json({ error: 'Candidate not found' });
    }
}